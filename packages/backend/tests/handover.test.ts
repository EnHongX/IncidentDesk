import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db.js';
import { handoverAlerts } from '../src/services/alert.service.js';

describe('handoverAlerts', () => {
  beforeEach(async () => {
    await prisma.timelineEntry.deleteMany();
    await prisma.alert.deleteMany();
  });

  afterAll(async () => {
    await prisma.timelineEntry.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.$disconnect();
  });

  it('transfers open alerts from one assignee to another', async () => {
    await prisma.alert.createMany({
      data: [
        { externalId: 'h1', title: 'Alert 1', source: 'test', severity: 'high', status: 'PROCESSING', assignee: 'alice' },
        { externalId: 'h2', title: 'Alert 2', source: 'test', severity: 'medium', status: 'CLAIMED', assignee: 'alice' },
        { externalId: 'h3', title: 'Alert 3', source: 'test', severity: 'low', status: 'RESOLVED', assignee: 'alice' },
        { externalId: 'h4', title: 'Alert 4', source: 'test', severity: 'high', status: 'PROCESSING', assignee: 'bob' },
      ],
    });

    const result = await handoverAlerts('alice', 'charlie', '下班交接');

    expect(result.transferred).toBe(2);

    const updated = await prisma.alert.findMany({ where: { assignee: 'charlie' } });
    expect(updated.length).toBe(2);
    expect(updated.every((a) => ['PROCESSING', 'CLAIMED'].includes(a.status))).toBe(true);

    // RESOLVED alert should NOT be transferred
    const resolved = await prisma.alert.findFirst({ where: { externalId: 'h3' } });
    expect(resolved!.assignee).toBe('alice');

    // Bob's alert should NOT be transferred
    const bobs = await prisma.alert.findFirst({ where: { externalId: 'h4' } });
    expect(bobs!.assignee).toBe('bob');
  });

  it('creates timeline entries for each transferred alert', async () => {
    await prisma.alert.create({
      data: { externalId: 'h5', title: 'Alert 5', source: 'test', severity: 'critical', status: 'PROCESSING', assignee: 'alice' },
    });

    await handoverAlerts('alice', 'dave', '请假交接');

    const entries = await prisma.timelineEntry.findMany();
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('HANDOVER');
    expect(entries[0].operator).toBe('dave');
    expect(entries[0].comment).toContain('alice');
    expect(entries[0].comment).toContain('dave');
    expect(entries[0].comment).toContain('请假交接');
  });

  it('returns zero transferred when no matching alerts', async () => {
    const result = await handoverAlerts('nobody', 'someone', '无告警测试');
    expect(result.transferred).toBe(0);
    expect(result.alertIds).toEqual([]);
  });
});
