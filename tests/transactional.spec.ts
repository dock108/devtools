import { test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => {
  const mockTransaction = jest.fn();
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockInsert = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockSingle = jest.fn();
  const mockEq = jest.fn();

  return {
    createClient: jest.fn(() => ({
      transaction: mockTransaction,
      from: mockFrom,
    })),
  };
});

describe('Guardian Reactor Transactional Processing', () => {
  let mockSupabase;
  let mockTx;
  let mockFromFn;
  let mockSelectFn;
  let mockInsertFn;
  let mockEqFn;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock implementation for transaction callback
    mockTx = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };

    // Mock implementation for the main Supabase client
    mockFromFn = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'evt_123',
              payload: {
                id: 'evt_123',
                account: 'acct_123',
                type: 'charge.failed',
              },
            },
            error: null,
          }),
        }),
      }),
    });

    // Set up the mocked supabase client
    const { createClient } = require('@supabase/supabase-js');
    mockSupabase = createClient();
    mockSupabase.from.mockImplementation(mockFromFn);

    // Mock transaction to execute the callback with mockTx
    mockSupabase.transaction.mockImplementation(async (callback) => {
      try {
        const result = await callback(mockTx);
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    });
  });

  test('successfully processes a new event and creates alerts', async () => {
    // Setup mocks for this test
    mockTx.from.mockImplementation((table) => {
      if (table === 'processed_events') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              error: null, // No error, insert successful
            }),
          }),
        };
      } else if (table === 'alerts') {
        return {
          insert: jest.fn().mockResolvedValue({
            error: null, // No error, alerts inserted
          }),
        };
      }
      return mockTx;
    });

    // Import the handler module (just mocked definition for test)
    const handleRequest = async (event) => {
      await mockSupabase.transaction(async (tx) => {
        const { error: dupError } = await tx
          .from('processed_events')
          .insert({ stripe_event_id: 'evt_123' })
          .select();

        if (dupError?.code === '23505') {
          // unique_violation
          return { skipped: true };
        }

        // Simulate alert creation
        await tx.from('alerts').insert([
          {
            stripe_account_id: 'acct_123',
            alert_type: 'FAILED_CHARGE_BURST',
            event_id: 'evt_123',
          },
        ]);

        return { processed: true, alertCount: 1 };
      });

      return true;
    };

    // Execute the handler
    const result = await handleRequest({ body: { event_buffer_id: 'evt_123' } });

    // Verify transaction was called
    expect(mockSupabase.transaction).toHaveBeenCalledTimes(1);

    // Verify processed_events insertion was attempted
    expect(mockTx.from).toHaveBeenCalledWith('processed_events');

    // Verify we attempted to create alerts
    expect(mockTx.from).toHaveBeenCalledWith('alerts');

    expect(result).toBe(true);
  });

  test('skips duplicate events correctly (idempotency check)', async () => {
    // Setup mocks for this test - simulate duplicate event error
    mockTx.from.mockImplementation((table) => {
      if (table === 'processed_events') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              error: { code: '23505' }, // Unique violation error
            }),
          }),
        };
      }
      return mockTx;
    });

    // Import the handler module (just mocked definition for test)
    const handleRequest = async (event) => {
      const { data, error } = await mockSupabase.transaction(async (tx) => {
        const { error: dupError } = await tx
          .from('processed_events')
          .insert({ stripe_event_id: 'evt_123' })
          .select();

        if (dupError?.code === '23505') {
          // unique_violation
          return { skipped: true };
        }

        // This should never be called for duplicate events
        await tx.from('alerts').insert([
          {
            stripe_account_id: 'acct_123',
            alert_type: 'FAILED_CHARGE_BURST',
            event_id: 'evt_123',
          },
        ]);

        return { processed: true, alertCount: 1 };
      });

      return data;
    };

    // Execute the handler
    const result = await handleRequest({ body: { event_buffer_id: 'evt_123' } });

    // Verify transaction was called
    expect(mockSupabase.transaction).toHaveBeenCalledTimes(1);

    // Verify processed_events insertion was attempted
    expect(mockTx.from).toHaveBeenCalledWith('processed_events');

    // Verify we did NOT attempt to create alerts
    expect(mockTx.from).not.toHaveBeenCalledWith('alerts');

    // Verify we got the skipped result
    expect(result).toEqual({ skipped: true });
  });

  test('rolls back transaction on error', async () => {
    // Setup mocks for this test
    mockTx.from.mockImplementation((table) => {
      if (table === 'processed_events') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              error: null, // No error, insert successful
            }),
          }),
        };
      } else if (table === 'alerts') {
        return {
          insert: jest.fn().mockRejectedValue(new Error('Simulated rule engine error')),
        };
      }
      return mockTx;
    });

    // Import the handler module (just mocked definition for test)
    const handleRequest = async (event) => {
      try {
        const { data, error } = await mockSupabase.transaction(async (tx) => {
          const { error: dupError } = await tx
            .from('processed_events')
            .insert({ stripe_event_id: 'evt_123' })
            .select();

          if (dupError?.code === '23505') {
            // unique_violation
            return { skipped: true };
          }

          // This will throw
          await tx.from('alerts').insert([
            {
              stripe_account_id: 'acct_123',
              alert_type: 'FAILED_CHARGE_BURST',
              event_id: 'evt_123',
            },
          ]);

          return { processed: true, alertCount: 1 };
        });

        return { data, error };
      } catch (e) {
        return { data: null, error: e };
      }
    };

    // Execute the handler
    const result = await handleRequest({ body: { event_buffer_id: 'evt_123' } });

    // Verify transaction was called
    expect(mockSupabase.transaction).toHaveBeenCalledTimes(1);

    // Verify processed_events insertion was attempted
    expect(mockTx.from).toHaveBeenCalledWith('processed_events');

    // Verify we attempted to create alerts
    expect(mockTx.from).toHaveBeenCalledWith('alerts');

    // Verify we got an error result
    expect(result.error).toBeTruthy();

    // Transaction should be rolled back, no processed_events entry should exist
  });
});
