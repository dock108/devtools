import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { evaluateRules } from '@/lib/guardian/rules/index';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { StripeEvent } from '@/lib/guardian/types';

// Mock the supabaseAdmin
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    data: []
  }
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Custom Rule Set', () => {
  let mockPayouts: any[] = [];
  let mockEvent: StripeEvent;
  
  beforeEach(() => {
    mockPayouts = [
      { type: 'payout.paid', created_at: new Date().toISOString() },
      { type: 'payout.paid', created_at: new Date().toISOString() },
      { type: 'payout.paid', created_at: new Date().toISOString() }
    ];
    
    mockEvent = {
      id: 'evt_123',
      account: 'acct_123',
      type: 'payout.paid',
      data: { object: { id: 'po_123', amount: 1000 } }
    } as any;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the supabase responses
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'connected_accounts') {
        return {
          ...supabaseAdmin,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null })
        };
      }
      
      return {
        ...supabaseAdmin,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: table === 'payout_events' ? mockPayouts : [] })
      };
    });
  });
  
  it('should use default rule set when no custom rule set exists', async () => {
    // Default rule set has maxPayouts: 3, so these 3 events should not trigger an alert
    const alerts = await evaluateRules(mockEvent);
    expect(alerts.length).toBe(0);
  });
  
  it('should respect custom rule set with stricter maxPayouts threshold', async () => {
    // Mock a custom rule set with maxPayouts: 2 (more strict than default)
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'connected_accounts') {
        return {
          ...supabaseAdmin,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              rule_set: {
                velocityBreach: { maxPayouts: 2, windowSeconds: 60 }
              }
            }
          })
        };
      }
      
      return {
        ...supabaseAdmin,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: table === 'payout_events' ? mockPayouts : [] })
      };
    });
    
    // With maxPayouts: 2 and 3 recent payouts, this should trigger an alert
    const alerts = await evaluateRules(mockEvent);
    expect(alerts.length).toBe(1);
    expect(alerts[0].alert_type).toBe('velocity_breach');
  });
  
  it('should handle errors when retrieving custom rule set', async () => {
    // Mock a failed database lookup
    (supabaseAdmin.from as jest.Mock).mockImplementation((table) => {
      if (table === 'connected_accounts') {
        return {
          ...supabaseAdmin,
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockRejectedValue(new Error('Database error'))
        };
      }
      
      return {
        ...supabaseAdmin,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: table === 'payout_events' ? mockPayouts : [] })
      };
    });
    
    // Should fall back to default rule set (maxPayouts: 3), so no alert expected
    const alerts = await evaluateRules(mockEvent);
    expect(alerts.length).toBe(0);
  });
}); 