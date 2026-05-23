import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db.js';
import { importAlerts } from '../src/services/alert.service.js';
import {
  aggregateAlerts,
  mergeIncidents,
  removeAlertFromIncident,
  closeIncident,
  getIncident,
  updateTimeWindow,
} from '../src/services/incident.service.js';

beforeEach(async () => {
  await prisma.incidentTimeline.deleteMany();
  await prisma.timelineEntry.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.incidentConfig.deleteMany();
});

afterAll(async () => {
  await prisma.incidentTimeline.deleteMany();
  await prisma.timelineEntry.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.incidentConfig.deleteMany();
  await prisma.$disconnect();
});

describe('Incident Aggregation', () => {
  it('groups alerts with same service+fingerprint into one incident', async () => {
    const result = await importAlerts([
      { externalId: 'A1', title: 'CPU high', source: 'prom', severity: 'high', service: 'payment', fingerprint: 'cpu-high' },
      { externalId: 'A2', title: 'CPU high again', source: 'prom', severity: 'critical', service: 'payment', fingerprint: 'cpu-high' },
    ]);

    expect(result.imported).toBe(2);
    expect(result.aggregated).toBe(2);
    expect(result.incidentIds.length).toBe(1);

    const incident = await getIncident(result.incidentIds[0]!);
    expect(incident).not.toBeNull();
    expect(incident!.alerts.length).toBe(2);
    expect(incident!.severity).toBe('critical');
    expect(incident!.service).toBe('payment');
    expect(incident!.fingerprint).toBe('cpu-high');
  });

  it('creates separate incidents for different fingerprints', async () => {
    const result = await importAlerts([
      { externalId: 'B1', title: 'CPU', source: 'prom', severity: 'high', service: 'payment', fingerprint: 'cpu' },
      { externalId: 'B2', title: 'Memory', source: 'prom', severity: 'medium', service: 'payment', fingerprint: 'mem' },
    ]);

    expect(result.incidentIds.length).toBe(2);
  });

  it('creates separate incidents for different services', async () => {
    const result = await importAlerts([
      { externalId: 'C1', title: 'CPU', source: 'prom', severity: 'high', service: 'payment', fingerprint: 'cpu' },
      { externalId: 'C2', title: 'CPU', source: 'prom', severity: 'high', service: 'auth', fingerprint: 'cpu' },
    ]);

    expect(result.incidentIds.length).toBe(2);
  });

  it('does not aggregate alerts without service/fingerprint', async () => {
    const result = await importAlerts([
      { externalId: 'D1', title: 'No svc', source: 'prom', severity: 'high' },
    ]);

    expect(result.imported).toBe(1);
    expect(result.aggregated).toBe(0);
  });

  it('respects time window — does not group beyond window', async () => {
    await updateTimeWindow(1); // 1 minute window

    // Create first alert directly with old timestamp
    await prisma.alert.create({
      data: {
        externalId: 'E1', title: 'Old', source: 'prom', severity: 'high',
        service: 'pay', fingerprint: 'fp1',
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      },
    });
    const old = await prisma.alert.findUnique({ where: { externalId: 'E1' } });
    await aggregateAlerts([old!.id]);

    // New alert should NOT join the old incident
    const result = await importAlerts([
      { externalId: 'E2', title: 'New', source: 'prom', severity: 'high', service: 'pay', fingerprint: 'fp1' },
    ]);

    expect(result.incidentIds.length).toBe(1);
    const incidents = await prisma.incident.findMany();
    expect(incidents.length).toBe(2);
  });

  it('upgrades incident severity when higher-severity alert arrives', async () => {
    const r1 = await importAlerts([
      { externalId: 'F1', title: 'Low', source: 'prom', severity: 'low', service: 'svc', fingerprint: 'fp' },
    ]);
    const incident = await getIncident(r1.incidentIds[0]!);
    expect(incident!.severity).toBe('low');

    await importAlerts([
      { externalId: 'F2', title: 'Critical', source: 'prom', severity: 'critical', service: 'svc', fingerprint: 'fp' },
    ]);
    const updated = await getIncident(r1.incidentIds[0]!);
    expect(updated!.severity).toBe('critical');
  });
});

describe('Incident Merge', () => {
  it('merges two open incidents', async () => {
    const r1 = await importAlerts([
      { externalId: 'M1', title: 'A', source: 'x', severity: 'high', service: 's', fingerprint: 'f1' },
    ]);
    const r2 = await importAlerts([
      { externalId: 'M2', title: 'B', source: 'x', severity: 'critical', service: 's', fingerprint: 'f2' },
    ]);

    const result = await mergeIncidents(r1.incidentIds[0]!, r2.incidentIds[0]!, '管理员', '重复事件');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.incident!.alerts.length).toBe(2);
    expect(result.incident!.severity).toBe('critical');

    const source = await getIncident(r2.incidentIds[0]!);
    expect(source!.status).toBe('MERGED');
  });

  it('rejects merge of closed incident', async () => {
    const r1 = await importAlerts([
      { externalId: 'N1', title: 'A', source: 'x', severity: 'high', service: 's', fingerprint: 'fp1' },
    ]);
    const r2 = await importAlerts([
      { externalId: 'N2', title: 'B', source: 'x', severity: 'high', service: 's', fingerprint: 'fp2' },
    ]);

    await closeIncident(r2.incidentIds[0]!, '管理员');
    const result = await mergeIncidents(r1.incidentIds[0]!, r2.incidentIds[0]!, '管理员');
    expect(result.success).toBe(false);
  });
});

describe('Remove Alert from Incident', () => {
  it('removes an alert and recalculates severity', async () => {
    const r = await importAlerts([
      { externalId: 'R1', title: 'Critical', source: 'x', severity: 'critical', service: 's', fingerprint: 'fp' },
      { externalId: 'R2', title: 'Low', source: 'x', severity: 'low', service: 's', fingerprint: 'fp' },
    ]);

    const incident = await getIncident(r.incidentIds[0]!);
    const criticalAlert = incident!.alerts.find((a) => a.externalId === 'R1')!;

    const result = await removeAlertFromIncident(r.incidentIds[0]!, criticalAlert.id, '管理员', '误关联');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.incident!.alerts.length).toBe(1);
    expect(result.incident!.severity).toBe('low');

    // Check timeline records the action
    const timeline = result.incident!.timeline;
    const removeEntry = timeline.find((t) => t.action === 'ALERT_REMOVED');
    expect(removeEntry).toBeDefined();
    expect(removeEntry!.operator).toBe('管理员');
  });

  it('rejects removal of the last alert', async () => {
    const r = await importAlerts([
      { externalId: 'S1', title: 'Only', source: 'x', severity: 'high', service: 's', fingerprint: 'fp' },
    ]);

    const incident = await getIncident(r.incidentIds[0]!);
    const result = await removeAlertFromIncident(r.incidentIds[0]!, incident!.alerts[0]!.id, '管理员');
    expect(result.success).toBe(false);
    expect(result.error).toContain('至少需要保留一条告警');
  });
});

describe('Close Incident', () => {
  it('closes an open incident with audit trail', async () => {
    const r = await importAlerts([
      { externalId: 'CL1', title: 'Close me', source: 'x', severity: 'high', service: 's', fingerprint: 'fp' },
    ]);

    const result = await closeIncident(r.incidentIds[0]!, '管理员', '已修复');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.incident!.status).toBe('CLOSED');
    const closeEntry = result.incident!.timeline.find((t) => t.action === 'CLOSED');
    expect(closeEntry).toBeDefined();
    expect(closeEntry!.operator).toBe('管理员');
  });
});
