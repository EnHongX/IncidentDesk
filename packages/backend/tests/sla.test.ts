import { describe, it, expect } from 'vitest';
import { computeSlaStatus } from '../src/services/sla.service.js';

describe('computeSlaStatus', () => {
  const deadline = 60; // 60 minutes

  it('returns null for RESOLVED alerts', () => {
    const created = new Date('2024-01-01T00:00:00Z');
    expect(computeSlaStatus(created, 'RESOLVED', deadline)).toBeNull();
  });

  it('returns null for FALSE_POSITIVE alerts', () => {
    const created = new Date('2024-01-01T00:00:00Z');
    expect(computeSlaStatus(created, 'FALSE_POSITIVE', deadline)).toBeNull();
  });

  it('returns "ok" when well within deadline', () => {
    const now = new Date('2024-01-01T00:10:00Z');
    const created = new Date('2024-01-01T00:00:00Z');
    const result = computeSlaStatus(created, 'NEW', deadline, now);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ok');
    expect(result!.remainingMs).toBe(50 * 60 * 1000);
  });

  it('returns "approaching" when within last 20% of deadline', () => {
    const now = new Date('2024-01-01T00:50:00Z');
    const created = new Date('2024-01-01T00:00:00Z');
    const result = computeSlaStatus(created, 'PROCESSING', deadline, now);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('approaching');
    expect(result!.remainingMs).toBe(10 * 60 * 1000);
  });

  it('returns "breached" when past deadline', () => {
    const now = new Date('2024-01-01T01:30:00Z');
    const created = new Date('2024-01-01T00:00:00Z');
    const result = computeSlaStatus(created, 'PROCESSING', deadline, now);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('breached');
    expect(result!.remainingMs).toBe(-30 * 60 * 1000);
  });

  it('boundary: exactly at deadline is breached', () => {
    const now = new Date('2024-01-01T01:00:00Z');
    const created = new Date('2024-01-01T00:00:00Z');
    const result = computeSlaStatus(created, 'PROCESSING', deadline, now);
    expect(result!.status).toBe('breached');
  });

  it('boundary: exactly at approaching threshold', () => {
    const now = new Date('2024-01-01T00:48:00Z');
    const created = new Date('2024-01-01T00:00:00Z');
    const result = computeSlaStatus(created, 'PROCESSING', deadline, now);
    expect(result!.status).toBe('approaching');
  });

  it('works for NEW status (SLA starts from creation)', () => {
    const now = new Date('2024-01-01T00:05:00Z');
    const created = new Date('2024-01-01T00:00:00Z');
    const result = computeSlaStatus(created, 'NEW', deadline, now);
    expect(result!.status).toBe('ok');
    expect(result!.remainingMs).toBe(55 * 60 * 1000);
  });
});
