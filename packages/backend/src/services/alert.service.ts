import { getTransition } from '../state-machine.js';
import { prisma } from '../db.js';
import { computeSlaStatus, getSlaConfigMap } from './sla.service.js';
import { aggregateAlerts } from './incident.service.js';

export interface AlertImportItem {
  externalId: string;
  title: string;
  source: string;
  severity: string;
  description?: string;
  metadata?: Record<string, unknown>;
  service?: string;
  fingerprint?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  skippedIds: string[];
  aggregated: number;
  incidentIds: string[];
}

export async function importAlerts(items: AlertImportItem[]): Promise<ImportResult> {
  const skippedIds: string[] = [];

  // Deduplicate within the batch itself — keep first occurrence, skip later duplicates
  const seen = new Set<string>();
  const unique: AlertImportItem[] = [];
  for (const item of items) {
    if (seen.has(item.externalId)) {
      skippedIds.push(item.externalId);
    } else {
      seen.add(item.externalId);
      unique.push(item);
    }
  }

  // Deduplicate against existing records in DB
  const externalIds = unique.map((i) => i.externalId);
  const existing = await prisma.alert.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((e) => e.externalId));

  const toCreate: AlertImportItem[] = [];
  for (const item of unique) {
    if (existingSet.has(item.externalId)) {
      skippedIds.push(item.externalId);
    } else {
      toCreate.push(item);
    }
  }

  if (toCreate.length > 0) {
    await prisma.alert.createMany({
      data: toCreate.map((item) => ({
        externalId: item.externalId,
        title: item.title,
        source: item.source,
        severity: item.severity,
        description: item.description ?? null,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
        service: item.service ?? null,
        fingerprint: item.fingerprint ?? null,
      })),
    });
  }

  // Aggregate newly imported alerts into incidents
  let aggregated = 0;
  let incidentIds: string[] = [];
  if (toCreate.length > 0) {
    const created = await prisma.alert.findMany({
      where: { externalId: { in: toCreate.map((i) => i.externalId) } },
      select: { id: true },
    });
    const result = await aggregateAlerts(created.map((a) => a.id));
    aggregated = result.aggregated;
    incidentIds = result.incidents;
  }

  return { imported: toCreate.length, skipped: skippedIds.length, skippedIds, aggregated, incidentIds };
}

export async function listAlerts(filters: {
  status?: string;
  severity?: string;
  source?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.severity) where.severity = filters.severity;
  if (filters.source) where.source = filters.source;
  if (filters.search) where.title = { contains: filters.search };

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
  });

  const slaMap = await getSlaConfigMap();
  const now = new Date();

  return alerts.map((a) => {
    const deadline = slaMap.get(a.severity);
    const sla = deadline
      ? computeSlaStatus(a.createdAt, a.status, deadline, now)
      : null;
    return { ...a, sla };
  });
}

export async function getAlert(id: string) {
  const alert = await prisma.alert.findUnique({
    where: { id },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
  });
  if (!alert) return null;

  const slaMap = await getSlaConfigMap();
  const deadline = slaMap.get(alert.severity);
  const sla = deadline
    ? computeSlaStatus(alert.createdAt, alert.status, deadline)
    : null;
  return { ...alert, sla };
}

export async function handoverAlerts(
  fromAssignee: string,
  toAssignee: string,
  reason: string
) {
  const alerts = await prisma.alert.findMany({
    where: {
      assignee: fromAssignee,
      status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] },
    },
  });

  if (alerts.length === 0) {
    return { transferred: 0, alertIds: [] };
  }

  const alertIds = alerts.map((a) => a.id);

  await prisma.$transaction(async (tx) => {
    await tx.alert.updateMany({
      where: { id: { in: alertIds } },
      data: { assignee: toAssignee },
    });

    for (const alertId of alertIds) {
      await tx.timelineEntry.create({
        data: {
          alertId,
          action: 'HANDOVER',
          operator: toAssignee,
          comment: `值班交接: ${fromAssignee} → ${toAssignee}，原因: ${reason}`,
          fromState: null,
          toState: null,
        },
      });
    }
  });

  return { transferred: alerts.length, alertIds };
}

export async function performAction(
  alertId: string,
  action: string,
  operator?: string,
  comment?: string
) {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) {
    return { success: false, error: 'Alert not found' } as const;
  }

  const transition = getTransition(action, alert.status);
  if (!transition.valid) {
    return { success: false, error: transition.error } as const;
  }

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: {
      status: transition.to,
      assignee: action === 'CLAIM' ? (operator ?? alert.assignee) : alert.assignee,
    },
  });

  await prisma.timelineEntry.create({
    data: {
      alertId,
      action,
      operator: operator ?? null,
      comment: comment ?? null,
      fromState: alert.status,
      toState: transition.to,
    },
  });

  const full = await getAlert(alertId);

  return { success: true, alert: full } as const;
}

