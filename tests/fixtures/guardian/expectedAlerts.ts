import { AlertSeverity, AlertType } from '@/lib/guardian/alerts';

// Simple helper to create the expected objects for comparison in tests
interface ExpectedAlert {
  type: AlertType;
  severity: AlertSeverity;
  payoutId?: string;
  externalAccountId?: string;
  accountId?: string; // Made optional for testing
}

export const expectedAlerts: Record<string, ExpectedAlert[]> = {
  'velocity-breach': [
    { 
      type: AlertType.VELOCITY,
      payoutId: 'po_1PQrPyBtYGWWCuMs6bJxR3kT', 
      severity: AlertSeverity.HIGH,
      accountId: 'unknown'
    },
  ],
  'bank-swap': [
    { 
      type: AlertType.BANK_SWAP, 
      externalAccountId: 'ba_1PQsFzCsHXA8Y4KpXvWtU3sR', 
      severity: AlertSeverity.HIGH,
      accountId: 'unknown'
    },
    { 
      type: AlertType.BANK_SWAP, 
      externalAccountId: 'ba_1PQsFzCsHXA8Y4KpXvWtU3sR', 
      severity: AlertSeverity.HIGH,
      accountId: 'unknown'
    }
  ],
  'geo-mismatch': [
    { 
      type: AlertType.GEO_MISMATCH, 
      payoutId: 'po_1PQthzBcDeFgH5jKbCdEfGh', 
      severity: AlertSeverity.MEDIUM,
      accountId: 'unknown'
    },
  ],
}; 