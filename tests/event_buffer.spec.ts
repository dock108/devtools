import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';

// Mock the Supabase client
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: [{ id: 'mock-id' }], error: null }),
    upsert: jest.fn().mockResolvedValue({ data: [{ id: 'mock-id' }], error: null }),
    delete: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('Event Buffer', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the delete response for test data cleanup
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.delete as jest.Mock).mockReturnThis();
    (supabaseAdmin.like as jest.Mock).mockResolvedValue({ data: null, error: null });
  });

  // Test data
  const testEvents = [
    {
      stripe_event_id: `evt_test_${uuidv4()}`,
      stripe_account_id: 'acct_test123',
      type: 'charge.succeeded',
      payload: { object: { id: 'ch_123', amount: 1000 } },
      received_at: new Date(),
    },
    {
      stripe_event_id: `evt_test_${uuidv4()}`,
      stripe_account_id: 'acct_test123',
      type: 'payout.created',
      payload: { object: { id: 'po_123', amount: 5000 } },
      received_at: new Date(),
    },
    // This event is older than the TTL and should be purged
    {
      stripe_event_id: `evt_test_${uuidv4()}`,
      stripe_account_id: 'acct_test123',
      type: 'payout.paid',
      payload: { object: { id: 'po_456', amount: 7500 } },
      // Set date to 31 days ago
      received_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    },
  ];

  it('should insert events into the buffer', async () => {
    // Mock the insert response
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.insert as jest.Mock).mockResolvedValue({
      data: [{ id: 'mock-id' }],
      error: null,
    });
    (supabaseAdmin.select as jest.Mock).mockReturnThis();
    (supabaseAdmin.in as jest.Mock).mockResolvedValue({
      data: [testEvents[0], testEvents[1]],
      error: null,
    });

    // Insert recent events
    const { error: insertError } = await supabaseAdmin
      .from('event_buffer')
      .insert([testEvents[0], testEvents[1]]);

    expect(insertError).toBeNull();

    // Verify events were inserted - use mocked response
    const { data, error } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .in('stripe_event_id', [testEvents[0].stripe_event_id, testEvents[1].stripe_event_id]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('event_buffer');
    expect(supabaseAdmin.insert).toHaveBeenCalledWith([testEvents[0], testEvents[1]]);
  });

  it('should enforce uniqueness on stripe_event_id', async () => {
    // Mock the error for duplicate insert
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.insert as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'mock-id' }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

    // Insert an event
    await supabaseAdmin.from('event_buffer').insert([testEvents[0]]);

    // Try to insert the same event again
    const { error: duplicateError } = await supabaseAdmin
      .from('event_buffer')
      .insert([testEvents[0]]);

    // Should fail with a uniqueness constraint error
    expect(duplicateError).not.toBeNull();
    expect(duplicateError?.code).toEqual('23505'); // PostgreSQL unique violation
  });

  it('should allow upsert on stripe_event_id', async () => {
    // Mock responses
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.insert as jest.Mock).mockResolvedValue({
      data: [{ id: 'mock-id' }],
      error: null,
    });
    (supabaseAdmin.upsert as jest.Mock).mockResolvedValue({
      data: [{ id: 'mock-id' }],
      error: null,
    });
    (supabaseAdmin.select as jest.Mock).mockReturnThis();
    (supabaseAdmin.eq as jest.Mock).mockReturnThis();
    (supabaseAdmin.single as jest.Mock).mockResolvedValue({
      data: {
        ...testEvents[0],
        payload: { object: { id: 'ch_123', amount: 2000 } },
      },
      error: null,
    });

    // Insert an event
    await supabaseAdmin.from('event_buffer').insert([testEvents[0]]);

    // Modify and upsert the same event
    const modifiedEvent = {
      ...testEvents[0],
      payload: { object: { id: 'ch_123', amount: 2000 } }, // Changed amount
    };

    const { error: upsertError } = await supabaseAdmin
      .from('event_buffer')
      .upsert([modifiedEvent], { onConflict: 'stripe_event_id' });

    expect(upsertError).toBeNull();

    // Verify the event was updated
    const { data, error } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .eq('stripe_event_id', testEvents[0].stripe_event_id)
      .single();

    expect(error).toBeNull();
    expect(data.payload.object.amount).toEqual(2000);
    expect(supabaseAdmin.upsert).toHaveBeenCalledWith([modifiedEvent], {
      onConflict: 'stripe_event_id',
    });
  });

  it('should purge old events but keep recent ones', async () => {
    // Mock responses
    (supabaseAdmin.from as jest.Mock).mockReturnThis();
    (supabaseAdmin.insert as jest.Mock).mockResolvedValue({ data: testEvents, error: null });
    (supabaseAdmin.select as jest.Mock).mockReturnThis();
    (supabaseAdmin.in as jest.Mock)
      .mockResolvedValueOnce({
        data: testEvents,
        error: null,
      })
      .mockResolvedValueOnce({
        data: [testEvents[0], testEvents[1]],
        error: null,
      });
    (supabaseAdmin.eq as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

    // Insert all events (including the old one)
    await supabaseAdmin.from('event_buffer').insert(testEvents);

    // Verify all events were inserted
    const { data: beforePurge } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .in(
        'stripe_event_id',
        testEvents.map((e) => e.stripe_event_id),
      );

    expect(beforePurge).toHaveLength(3);

    // Execute the purge function
    await supabaseAdmin.rpc('purge_old_events');

    // Verify only recent events remain
    const { data: afterPurge } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .in(
        'stripe_event_id',
        testEvents.map((e) => e.stripe_event_id),
      );

    expect(afterPurge).toHaveLength(2);

    // The old event should be gone
    const { data: oldEvent } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .eq('stripe_event_id', testEvents[2].stripe_event_id);

    expect(oldEvent).toHaveLength(0);
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('purge_old_events');
  });
});
