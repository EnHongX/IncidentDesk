import { prisma } from '../db.js';

export interface SlaStatus {
  deadlineMinutes: number;
  remainingMs: number;
  status: 'ok' | 'approaching' | 'breached';
}

const TERMINAL_STATUSES = ['RESOLVED', 'FALSE_POSITIVE'];
const APPROACHING_THRESHOLD = 0.2;

export async function getSlaConfigMap(): Promise<Map<string, number>> {
  const configs = await prisma.slaConfig.findMany();
  return new Map(configs.map((c) => [c.severity, c.deadlineMinutes]));
}

export function computeSlaStatus(
  createdAt: Date,
  alertStatus: string,
  deadlineMinutes: number,
  now: Date = new Date()
): SlaStatus | null {
  if (TERMINAL_STATUSES.includes(alertStatus)) return null;

  const deadlineMs = deadlineMinutes * 60 * 1000;
  const elapsedMs = now.getTime() - createdAt.getTime();
  const remainingMs = deadlineMs - elapsedMs;

  if (remainingMs <= 0) {
    return { deadlineMinutes, remainingMs, status: 'breached' };
  }

  const threshold = deadlineMs * APPROACHING_THRESHOLD;
  if (remainingMs <= threshold) {
    return { deadlineMinutes, remainingMs, status: 'approaching' };
  }

  return { deadlineMinutes, remainingMs, status: 'ok' };
}
