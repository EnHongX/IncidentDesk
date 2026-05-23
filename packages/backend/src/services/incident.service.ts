import { prisma } from '../db.js';

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function highestSeverity(current: string, incoming: string): string {
  return (SEVERITY_RANK[incoming] ?? 0) > (SEVERITY_RANK[current] ?? 0)
    ? incoming
    : current;
}

export async function getTimeWindowMin(): Promise<number> {
  const config = await prisma.incidentConfig.findFirst();
  return config?.timeWindowMin ?? 60;
}

export async function updateTimeWindow(minutes: number) {
  const existing = await prisma.incidentConfig.findFirst();
  if (existing) {
    return prisma.incidentConfig.update({
      where: { id: existing.id },
      data: { timeWindowMin: minutes },
    });
  }
  return prisma.incidentConfig.create({ data: { timeWindowMin: minutes } });
}

export async function aggregateAlerts(
  alertIds: string[]
): Promise<{ aggregated: number; incidents: string[] }> {
  if (alertIds.length === 0) return { aggregated: 0, incidents: [] };

  const alerts = await prisma.alert.findMany({
    where: { id: { in: alertIds } },
  });

  const timeWindowMin = await getTimeWindowMin();
  const incidentIds = new Set<string>();
  let aggregated = 0;

  for (const alert of alerts) {
    if (!alert.service || !alert.fingerprint) continue;

    const windowStart = new Date(
      alert.createdAt.getTime() - timeWindowMin * 60 * 1000
    );

    // Find open incident with same service+fingerprint where the most recent
    // alert was added within the time window
    const candidates = await prisma.incident.findMany({
      where: {
        service: alert.service,
        fingerprint: alert.fingerprint,
        status: 'OPEN',
      },
      include: {
        alerts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const openIncident = candidates.find((inc) => {
      const lastAlert = inc.alerts[0];
      if (!lastAlert) return true; // empty incident — allow grouping
      return lastAlert.createdAt >= windowStart;
    });

    if (openIncident) {
      const newSeverity = highestSeverity(openIncident.severity, alert.severity);
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: {
          severity: newSeverity,
        },
      });
      await prisma.alert.update({
        where: { id: alert.id },
        data: { incidentId: openIncident.id },
      });
      await prisma.incidentTimeline.create({
        data: {
          incidentId: openIncident.id,
          action: 'ALERT_ADDED',
          detail: JSON.stringify({
            alertId: alert.id,
            externalId: alert.externalId,
            title: alert.title,
          }),
        },
      });
      if (newSeverity !== openIncident.severity) {
        await prisma.incidentTimeline.create({
          data: {
            incidentId: openIncident.id,
            action: 'SEVERITY_UPGRADED',
            detail: JSON.stringify({
              from: openIncident.severity,
              to: newSeverity,
              trigger: alert.externalId,
            }),
          },
        });
      }
      incidentIds.add(openIncident.id);
      aggregated++;
    } else {
      const incident = await prisma.incident.create({
        data: {
          title: alert.title,
          service: alert.service,
          fingerprint: alert.fingerprint,
          severity: alert.severity,
        },
      });
      await prisma.alert.update({
        where: { id: alert.id },
        data: { incidentId: incident.id },
      });
      await prisma.incidentTimeline.create({
        data: {
          incidentId: incident.id,
          action: 'CREATED',
          detail: JSON.stringify({
            alertId: alert.id,
            externalId: alert.externalId,
            title: alert.title,
          }),
        },
      });
      incidentIds.add(incident.id);
      aggregated++;
    }
  }

  return { aggregated, incidents: [...incidentIds] };
}

export async function listIncidents(filters: {
  status?: string;
  service?: string;
  severity?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.service) where.service = filters.service;
  if (filters.severity) where.severity = filters.severity;

  return prisma.incident.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      alerts: { select: { id: true, title: true, severity: true, status: true, externalId: true, createdAt: true } },
      timeline: { orderBy: { createdAt: 'asc' } },
      _count: { select: { alerts: true } },
    },
  });
}

export async function getIncident(id: string) {
  return prisma.incident.findUnique({
    where: { id },
    include: {
      alerts: {
        orderBy: { createdAt: 'desc' },
        include: { timeline: { orderBy: { createdAt: 'asc' } } },
      },
      timeline: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function mergeIncidents(
  targetId: string,
  sourceId: string,
  operator: string,
  comment?: string
) {
  const [target, source] = await Promise.all([
    prisma.incident.findUnique({ where: { id: targetId }, include: { alerts: true } }),
    prisma.incident.findUnique({ where: { id: sourceId }, include: { alerts: true } }),
  ]);

  if (!target) return { success: false, error: '目标事件不存在' } as const;
  if (!source) return { success: false, error: '源事件不存在' } as const;
  if (target.status !== 'OPEN') return { success: false, error: '目标事件已关闭' } as const;
  if (source.status !== 'OPEN') return { success: false, error: '源事件已关闭' } as const;

  const newSeverity = source.alerts.reduce(
    (sev, a) => highestSeverity(sev, a.severity),
    target.severity
  );

  await prisma.$transaction(async (tx) => {
    await tx.alert.updateMany({
      where: { incidentId: sourceId },
      data: { incidentId: targetId },
    });

    await tx.incident.update({
      where: { id: targetId },
      data: { severity: newSeverity },
    });

    await tx.incident.update({
      where: { id: sourceId },
      data: { status: 'MERGED' },
    });

    const detail = JSON.stringify({
      sourceIncidentId: sourceId,
      sourceTitle: source.title,
      alertsMoved: source.alerts.length,
      comment: comment ?? null,
    });

    await tx.incidentTimeline.create({
      data: { incidentId: targetId, action: 'MERGED_IN', detail, operator },
    });

    await tx.incidentTimeline.create({
      data: {
        incidentId: sourceId,
        action: 'MERGED_OUT',
        detail: JSON.stringify({ targetIncidentId: targetId, targetTitle: target.title, comment: comment ?? null }),
        operator,
      },
    });
  });

  return { success: true, incident: await getIncident(targetId) } as const;
}

export async function removeAlertFromIncident(
  incidentId: string,
  alertId: string,
  operator: string,
  comment?: string
) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { alerts: true },
  });

  if (!incident) return { success: false, error: '事件不存在' } as const;
  if (incident.status !== 'OPEN') return { success: false, error: '事件已关闭' } as const;

  const alert = incident.alerts.find((a) => a.id === alertId);
  if (!alert) return { success: false, error: '该告警不属于此事件' } as const;

  if (incident.alerts.length <= 1) {
    return { success: false, error: '事件至少需要保留一条告警' } as const;
  }

  await prisma.$transaction(async (tx) => {
    await tx.alert.update({
      where: { id: alertId },
      data: { incidentId: null },
    });

    const remaining = incident.alerts.filter((a) => a.id !== alertId);
    const newSeverity = remaining.reduce(
      (sev, a) => highestSeverity(sev, a.severity),
      'low'
    );
    await tx.incident.update({
      where: { id: incidentId },
      data: { severity: newSeverity },
    });

    await tx.incidentTimeline.create({
      data: {
        incidentId,
        action: 'ALERT_REMOVED',
        detail: JSON.stringify({
          alertId,
          externalId: alert.externalId,
          title: alert.title,
          comment: comment ?? null,
        }),
        operator,
      },
    });
  });

  return { success: true, incident: await getIncident(incidentId) } as const;
}

export async function closeIncident(
  id: string,
  operator: string,
  comment?: string
) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) return { success: false, error: '事件不存在' } as const;
  if (incident.status !== 'OPEN') return { success: false, error: '事件已关闭' } as const;

  await prisma.$transaction(async (tx) => {
    await tx.incident.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    await tx.incidentTimeline.create({
      data: {
        incidentId: id,
        action: 'CLOSED',
        detail: comment ? JSON.stringify({ comment }) : null,
        operator,
      },
    });
  });

  return { success: true, incident: await getIncident(id) } as const;
}
