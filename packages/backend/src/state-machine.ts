export const AlertStatus = {
  NEW: 'NEW',
  CLAIMED: 'CLAIMED',
  PROCESSING: 'PROCESSING',
  RESOLVED: 'RESOLVED',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
} as const;

export type AlertStatusType = (typeof AlertStatus)[keyof typeof AlertStatus];

export const ActionType = {
  CLAIM: 'CLAIM',
  START: 'START',
  RESOLVE: 'RESOLVE',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
} as const;

export type ActionTypeValue = (typeof ActionType)[keyof typeof ActionType];

const TRANSITIONS: Record<string, { from: AlertStatusType[]; to: AlertStatusType }> = {
  [ActionType.CLAIM]: { from: ['NEW'], to: 'CLAIMED' },
  [ActionType.START]: { from: ['CLAIMED'], to: 'PROCESSING' },
  [ActionType.RESOLVE]: { from: ['PROCESSING'], to: 'RESOLVED' },
  [ActionType.FALSE_POSITIVE]: { from: ['NEW', 'CLAIMED', 'PROCESSING'], to: 'FALSE_POSITIVE' },
};

export function getTransition(action: string, currentStatus: string) {
  const rule = TRANSITIONS[action];
  if (!rule) {
    return { valid: false, error: `Unknown action: ${action}` } as const;
  }
  if (!rule.from.includes(currentStatus as AlertStatusType)) {
    return {
      valid: false,
      error: `Cannot perform "${action}" on alert in status "${currentStatus}". Allowed from: [${rule.from.join(', ')}]`,
    } as const;
  }
  return { valid: true, to: rule.to } as const;
}
