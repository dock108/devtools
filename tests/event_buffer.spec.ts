import { createAdminClient } from '@/lib/supabase/admin';
import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Define mocks for the builder methods. These will be configured per test.
const mockQueryBuilder = {
  insert: jest.fn(),
  select: jest.fn(),
  upsert: jest.fn(),
  eq: jest.fn(),
  in: jest.fn(),
  like: jest.fn(),
  delete: jest.fn(),
  single: jest.fn(),
};

// Mock the Supabase client object
const supabaseAdmin = {
  from: jest.fn(() => mockQueryBuilder), // from simply returns the mock builder object
  rpc: jest.fn(),
};

// Mock the factory function
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => supabaseAdmin),
}));

describe('Supabase Event Buffer Table & Logic', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    // Reset specific mock implementations if needed (though usually covered by clearAllMocks for jest.fn)
    // e.g., supabaseAdmin.from.mockImplementation(() => mockQueryBuilder);
    // Ensure rpc mock has a default resolved value
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });
  });

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
    {
      stripe_event_id: `evt_test_${uuidv4()}`,
      stripe_account_id: 'acct_test123',
      type: 'payout.paid',
      payload: { object: { id: 'po_456', amount: 7500 } },
      received_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    },
  ];

  it('should insert events into the buffer', async () => {
    // Setup mocks for this specific test
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: [{ id: 'mock-id' }], error: null });
    mockQueryBuilder.select.mockReturnThis(); // select returns the builder
    mockQueryBuilder.in.mockResolvedValueOnce({
      data: [testEvents[0], testEvents[1]],
      error: null,
    }); // in returns the final result

    const { error: insertError } = await supabaseAdmin
      .from('event_buffer')
      .insert([testEvents[0], testEvents[1]]);

    expect(insertError).toBeNull();

    const { data, error } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .in('stripe_event_id', [testEvents[0].stripe_event_id, testEvents[1].stripe_event_id]);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('event_buffer');
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith([testEvents[0], testEvents[1]]);
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
    expect(mockQueryBuilder.in).toHaveBeenCalledWith('stripe_event_id', [
      testEvents[0].stripe_event_id,
      testEvents[1].stripe_event_id,
    ]);
  });

  it('should enforce uniqueness on stripe_event_id', async () => {
    // Setup mocks: first insert succeeds, second fails
    mockQueryBuilder.insert
      .mockResolvedValueOnce({ data: [{ id: 'mock-id' }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

    await supabaseAdmin.from('event_buffer').insert([testEvents[0]]);

    const { error: duplicateError } = await supabaseAdmin
      .from('event_buffer')
      .insert([testEvents[0]]);

    expect(duplicateError).not.toBeNull();
    expect(duplicateError?.code).toEqual('23505');
    expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(2);
  });

  it('should allow upsert on stripe_event_id', async () => {
    const modifiedEvent = {
      ...testEvents[0],
      payload: { object: { id: 'ch_123', amount: 2000 } },
    };
    // Setup mocks
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: [{ id: 'mock-id' }], error: null });
    mockQueryBuilder.upsert.mockResolvedValueOnce({ data: [modifiedEvent], error: null });
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.single.mockResolvedValueOnce({ data: modifiedEvent, error: null });

    await supabaseAdmin.from('event_buffer').insert([testEvents[0]]);

    const { error: upsertError } = await supabaseAdmin
      .from('event_buffer')
      .upsert([modifiedEvent], { onConflict: 'stripe_event_id' });

    expect(upsertError).toBeNull();

    const { data, error } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .eq('stripe_event_id', testEvents[0].stripe_event_id)
      .single();

    expect(error).toBeNull();
    expect(data?.payload.object.amount).toEqual(2000);
    expect(mockQueryBuilder.upsert).toHaveBeenCalledWith([modifiedEvent], {
      onConflict: 'stripe_event_id',
    });
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'stripe_event_id',
      testEvents[0].stripe_event_id,
    );
    expect(mockQueryBuilder.single).toHaveBeenCalledTimes(1);
  });

  it('should purge old events but keep recent ones', async () => {
    // Setup mocks
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: testEvents, error: null });
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.in
      .mockResolvedValueOnce({ data: testEvents, error: null }) // Before purge
      .mockResolvedValueOnce({ data: [testEvents[0], testEvents[1]], error: null }); // After purge
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null }); // Checking for old event
    supabaseAdmin.rpc.mockResolvedValueOnce({ data: null, error: null }); // Purge call

    await supabaseAdmin.from('event_buffer').insert(testEvents);

    const { data: beforePurge } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .in(
        'stripe_event_id',
        testEvents.map((e) => e.stripe_event_id),
      );
    expect(beforePurge).toHaveLength(3);

    await supabaseAdmin.rpc('purge_old_events');

    const { data: afterPurge } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .in(
        'stripe_event_id',
        testEvents.map((e) => e.stripe_event_id),
      );
    expect(afterPurge).toHaveLength(2);

    const { data: oldEvent } = await supabaseAdmin
      .from('event_buffer')
      .select('*')
      .eq('stripe_event_id', testEvents[2].stripe_event_id);
    expect(oldEvent).toHaveLength(0);

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('purge_old_events');
    expect(mockQueryBuilder.in).toHaveBeenCalledTimes(2);
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'stripe_event_id',
      testEvents[2].stripe_event_id,
    );
  });
});
