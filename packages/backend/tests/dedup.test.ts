import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db.js';
import { importAlerts } from '../src/services/alert.service.js';

beforeEach(async () => {
  await prisma.timelineEntry.deleteMany();
  await prisma.alert.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Deduplication on Import', () => {
  const sampleAlerts = [
    { externalId: 'EXT-001', title: 'Test Alert 1', source: 'test', severity: 'high' },
    { externalId: 'EXT-002', title: 'Test Alert 2', source: 'test', severity: 'medium' },
  ];

  it('imports new alerts successfully', async () => {
    const result = await importAlerts(sampleAlerts);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

    const count = await prisma.alert.count();
    expect(count).toBe(2);
  });

  it('skips already-imported alerts', async () => {
    await importAlerts(sampleAlerts);
    const result = await importAlerts(sampleAlerts);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.skippedIds).toEqual(['EXT-001', 'EXT-002']);

    const count = await prisma.alert.count();
    expect(count).toBe(2);
  });

  it('imports only new alerts in a mixed batch', async () => {
    await importAlerts([sampleAlerts[0]]);

    const result = await importAlerts(sampleAlerts);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedIds).toEqual(['EXT-001']);

    const count = await prisma.alert.count();
    expect(count).toBe(2);
  });

  it('handles empty import', async () => {
    const result = await importAlerts([]);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('deduplicates within the same batch', async () => {
    const batch = [
      { externalId: 'EXT-DUP', title: 'First', source: 'test', severity: 'high' },
      { externalId: 'EXT-DUP', title: 'Duplicate', source: 'test', severity: 'high' },
      { externalId: 'EXT-OTHER', title: 'Other', source: 'test', severity: 'low' },
    ];

    const result = await importAlerts(batch);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.skippedIds).toContain('EXT-DUP');

    const count = await prisma.alert.count();
    expect(count).toBe(2);

    const saved = await prisma.alert.findUnique({ where: { externalId: 'EXT-DUP' } });
    expect(saved!.title).toBe('First');
  });

  it('handles intra-batch duplicates combined with DB duplicates', async () => {
    await importAlerts([{ externalId: 'EXT-A', title: 'Existing', source: 'test', severity: 'low' }]);

    const batch = [
      { externalId: 'EXT-A', title: 'Dup of existing', source: 'test', severity: 'low' },
      { externalId: 'EXT-B', title: 'New one', source: 'test', severity: 'medium' },
      { externalId: 'EXT-B', title: 'Dup in batch', source: 'test', severity: 'medium' },
    ];

    const result = await importAlerts(batch);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.skippedIds).toContain('EXT-A');
    expect(result.skippedIds).toContain('EXT-B');

    const count = await prisma.alert.count();
    expect(count).toBe(2);
  });
});
