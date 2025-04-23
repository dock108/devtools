export enum AlertType {
  VELOCITY = 'VELOCITY',
  BANK_SWAP = 'BANK_SWAP',
  GEO_MISMATCH = 'GEO_MISMATCH',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  payoutId?: string;
  externalAccountId?: string;
  accountId: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  autoPause?: boolean;
}

export function createVelocityAlert(
  payoutId: string,
  accountId: string,
  breachCount: number
): Alert {
  return {
    type: AlertType.VELOCITY,
    severity: AlertSeverity.HIGH,
    payoutId,
    accountId,
    metadata: { breachCount },
    timestamp: new Date(),
    autoPause: true,
  };
}

export function createBankSwapAlert(
  externalAccountId: string,
  accountId: string
): Alert {
  return {
    type: AlertType.BANK_SWAP,
    severity: AlertSeverity.HIGH,
    externalAccountId,
    accountId,
    timestamp: new Date(),
    autoPause: true,
  };
}

export function createGeoMismatchAlert(
  payoutId: string,
  accountId: string,
  metadata?: { country?: string; ip?: string }
): Alert {
  return {
    type: AlertType.GEO_MISMATCH,
    severity: AlertSeverity.MEDIUM,
    payoutId,
    accountId,
    metadata,
    timestamp: new Date(),
    autoPause: false,
  };
} 