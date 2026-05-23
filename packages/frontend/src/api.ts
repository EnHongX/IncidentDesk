const BASE = '/api';

export interface SlaStatus {
  deadlineMinutes: number;
  remainingMs: number;
  status: 'ok' | 'approaching' | 'breached';
}

export interface Alert {
  id: string;
  externalId: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  description: string | null;
  metadata: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
  sla: SlaStatus | null;
}

export interface TimelineEntry {
  id: string;
  action: string;
  operator: string | null;
  comment: string | null;
  fromState: string | null;
  toState: string | null;
  createdAt: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  skippedIds: string[];
}

export interface SlaConfigItem {
  severity: string;
  deadlineMinutes: number;
}

export interface HandoverResult {
  transferred: number;
  alertIds: string[];
}

export async function fetchAlerts(params?: Record<string, string>): Promise<Alert[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${BASE}/alerts${qs}`);
  return res.json();
}

export async function fetchAlert(id: string): Promise<Alert> {
  const res = await fetch(`${BASE}/alerts/${id}`);
  return res.json();
}

export async function importAlerts(alerts: unknown[]): Promise<ImportResult> {
  const res = await fetch(`${BASE}/alerts/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alerts }),
  });
  return res.json();
}

export async function performAction(
  id: string,
  action: string,
  operator?: string,
  comment?: string
): Promise<Alert> {
  const res = await fetch(`${BASE}/alerts/${id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, operator, comment }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Action failed');
  }
  return res.json();
}

export async function fetchSlaConfig(): Promise<SlaConfigItem[]> {
  const res = await fetch(`${BASE}/sla-config`);
  return res.json();
}

export async function updateSlaConfig(items: SlaConfigItem[]): Promise<SlaConfigItem[]> {
  const res = await fetch(`${BASE}/sla-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });
  return res.json();
}

export async function handoverAlerts(
  fromAssignee: string,
  toAssignee: string,
  reason: string
): Promise<HandoverResult> {
  const res = await fetch(`${BASE}/alerts/handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromAssignee, toAssignee, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '交接失败');
  }
  return res.json();
}

