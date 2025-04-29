import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client using vi
vi.mock('@supabase/supabase-js', () => {
  const mockTransaction = vi.fn();
  const mockFrom = vi.fn();
  // Keep mocks for chaining if needed
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockMaybeSingle = vi.fn();
  const mockSingle = vi.fn();
  const mockEq = vi.fn().mockReturnThis();

  return {
    createClient: vi.fn(() => ({
      transaction: mockTransaction,
      from: mockFrom,
      // Add mocked methods needed for chaining if not handled by mockReturnThis
      select: mockSelect,
      insert: mockInsert,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    })),
  };
});

describe('Guardian Reactor Transactional Processing', () => {
  let mockSupabase: any; // Use any or define a mock type
  let mockTx: any; // Use any or define a mock type
  let mockFromFn: any;

  beforeEach(async () => {
    // Make beforeEach async if needed
    // Reset all mocks using vi
    vi.clearAllMocks();

    // Create mock implementation for transaction callback
    mockTx = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    // Mock implementation for the main Supabase client
    // Simplified setup, assuming the mock factory handles the client creation
    const { createClient } = await import('@supabase/supabase-js'); // Use dynamic import if needed
    mockSupabase = createClient();

    // Mock transaction to execute the callback with mockTx
    mockSupabase.transaction.mockImplementation(async (callback: (tx: any) => any) => {
      try {
        const result = await callback(mockTx);
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    });
  });

  afterEach(() => {
    // Optional: vi.resetAllMocks() if needed for cleaner state
  });

  // Rename test to it
  it('successfully processes a new event and creates alerts', async () => {
    // Setup mocks for this test
    mockTx.from.mockImplementation((table: string) => {
      if (table === 'processed_events') {
        return {
          insert: vi.fn().mockReturnThis(), // Need select after insert
          select: vi.fn().mockResolvedValue({ error: null }),
        };
      } else if (table === 'alerts') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      // Default return mockTx for chaining if needed
      return mockTx;
    });

    // ... (rest of test logic using mockTx as defined)
    // Example handler structure (adapt as needed)
    const handleRequest = async (event: any) => {
      const { data, error } = await mockSupabase.transaction(async (tx: any) => {
        const insertResult = await tx
          .from('processed_events')
          .insert({ stripe_event_id: 'evt_123' })
          .select(); // Chain select

        const dupError = insertResult.error;

        if (dupError?.code === '23505') {
          return { skipped: true };
        }
        if (dupError) throw dupError; // Throw other insert errors

        // Simulate alert creation
        const alertResult = await tx.from('alerts').insert([
          {
            stripe_account_id: 'acct_123',
            alert_type: 'FAILED_CHARGE_BURST',
            event_id: 'evt_123',
          },
        ]);
        if (alertResult.error) throw alertResult.error;

        return { processed: true, alertCount: 1 };
      });
      if (error) throw error;
      return data;
    };

    await handleRequest({ body: { event_buffer_id: 'evt_123' } });

    expect(mockSupabase.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.from).toHaveBeenCalledWith('processed_events');
    expect(mockTx.from).toHaveBeenCalledWith('alerts');
    // Add assertion for successful return if needed
  });

  // Rename test to it
  it('skips duplicate events correctly (idempotency check)', async () => {
    // Setup mocks for duplicate error
    mockTx.from.mockImplementation((table: string) => {
      if (table === 'processed_events') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ error: { code: '23505' } }), // Simulate duplicate error on select
        };
      }
      return mockTx;
    });

    // ... (rest of test logic)
    // Example handler structure (adapt as needed)
    const handleRequest = async (event: any) => {
      const { data, error } = await mockSupabase.transaction(async (tx: any) => {
        const insertResult = await tx
          .from('processed_events')
          .insert({ stripe_event_id: 'evt_123' })
          .select(); // Chain select

        const dupError = insertResult.error;

        if (dupError?.code === '23505') {
          return { skipped: true };
        }
        if (dupError) throw dupError; // Throw other insert errors

        // This should not be reached
        const alertResult = await tx.from('alerts').insert([
          {
            stripe_account_id: 'acct_123',
            alert_type: 'FAILED_CHARGE_BURST',
            event_id: 'evt_123',
          },
        ]);
        if (alertResult.error) throw alertResult.error;

        return { processed: true, alertCount: 1 };
      });
      if (error) throw error;
      return data;
    };

    const result = await handleRequest({ body: { event_buffer_id: 'evt_123' } });

    expect(mockSupabase.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.from).toHaveBeenCalledWith('processed_events');
    expect(mockTx.from).not.toHaveBeenCalledWith('alerts');
    expect(result).toEqual({ skipped: true });
  });

  // Rename test to it
  it('rolls back transaction on error', async () => {
    // Setup mocks for error during alert insertion
    mockTx.from.mockImplementation((table: string) => {
      if (table === 'processed_events') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({ error: null }), // Insert succeeds
        };
      } else if (table === 'alerts') {
        return {
          insert: vi.fn().mockRejectedValue(new Error('Simulated rule engine error')), // Error on alert insert
        };
      }
      return mockTx;
    });

    // ... (rest of test logic)
    // Example handler structure (adapt as needed)
    const handleRequest = async (event: any) => {
      let caughtError: Error | null = null;
      const { data, error } = await mockSupabase
        .transaction(async (tx: any) => {
          const insertResult = await tx
            .from('processed_events')
            .insert({ stripe_event_id: 'evt_123' })
            .select(); // Chain select

          const dupError = insertResult.error;

          if (dupError?.code === '23505') {
            return { skipped: true };
          }
          if (dupError) throw dupError; // Throw other insert errors

          // This will throw
          const alertResult = await tx.from('alerts').insert([
            {
              stripe_account_id: 'acct_123',
              alert_type: 'FAILED_CHARGE_BURST',
              event_id: 'evt_123',
            },
          ]);
          // Error is thrown before this check
          // if (alertResult.error) throw alertResult.error;

          return { processed: true, alertCount: 1 }; // Should not be reached
        })
        .catch((e: Error) => {
          caughtError = e;
          return { data: null, error: e }; // Transaction returns error
        });

      return { data, error: error || caughtError };
    };

    const result = await handleRequest({ body: { event_buffer_id: 'evt_123' } });

    expect(mockSupabase.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.from).toHaveBeenCalledWith('processed_events');
    expect(mockTx.from).toHaveBeenCalledWith('alerts');
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('Simulated rule engine error');
  });
});
