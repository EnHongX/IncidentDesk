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

// --- Incident types ---

export interface IncidentTimelineEntry {
  id: string;
  action: string;
  detail: string | null;
  operator: string | null;
  createdAt: string;
}

export interface IncidentAlertSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  externalId: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  service: string;
  fingerprint: string;
  severity: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  alerts: IncidentAlertSummary[];
  timeline: IncidentTimelineEntry[];
  _count?: { alerts: number };
}

export interface IncidentConfig {
  timeWindowMin: number;
}

// --- Incident API ---

export async function fetchIncidents(params?: Record<string, string>): Promise<Incident[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${BASE}/incidents${qs}`);
  return res.json();
}

export async function fetchIncident(id: string): Promise<Incident> {
  const res = await fetch(`${BASE}/incidents/${id}`);
  return res.json();
}

export async function mergeIncident(
  targetId: string,
  sourceIncidentId: string,
  operator: string,
  comment?: string
): Promise<Incident> {
  const res = await fetch(`${BASE}/incidents/${targetId}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceIncidentId, operator, comment }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '合并失败');
  }
  return res.json();
}

export async function removeAlertFromIncident(
  incidentId: string,
  alertId: string,
  operator: string,
  comment?: string
): Promise<Incident> {
  const res = await fetch(`${BASE}/incidents/${incidentId}/remove-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId, operator, comment }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '移出失败');
  }
  return res.json();
}

export async function closeIncident(
  id: string,
  operator: string,
  comment?: string
): Promise<Incident> {
  const res = await fetch(`${BASE}/incidents/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator, comment }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '关闭失败');
  }
  return res.json();
}

export async function fetchIncidentConfig(): Promise<IncidentConfig> {
  const res = await fetch(`${BASE}/incident-config`);
  return res.json();
}

export async function updateIncidentConfig(timeWindowMin: number): Promise<IncidentConfig> {
  const res = await fetch(`${BASE}/incident-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeWindowMin }),
  });
  return res.json();
}

