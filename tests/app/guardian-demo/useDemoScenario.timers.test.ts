import { renderHook, act } from '@testing-library/react';
import { useDemoScenario } from '@/app/guardian-demo/useDemoScenario';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock timer
vi.useFakeTimers();

describe('useDemoScenario timer management', () => {
  const mockScenario1 = [
    {
      delayMs: 0,
      type: 'account.updated',
      payload: {
        id: 'acct_test1',
        object: 'account',
      },
    },
    {
      delayMs: 2000,
      type: 'payout.paid',
      payload: {
        id: 'po_test1',
        object: 'payout',
        amount: 1000,
      },
    },
  ];

  const mockScenario2 = [
    {
      delayMs: 0,
      type: 'account.updated',
      payload: {
        id: 'acct_test2',
        object: 'account',
      },
    },
    {
      delayMs: 5000,
      type: 'payout.paid',
      payload: {
        id: 'po_test2',
        object: 'payout',
        amount: 2000,
      },
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('cancels previous fetch when scenario changes quickly', async () => {
    // First mock fetch for scenario1
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => mockScenario1,
          });
        }, 500); // Delayed response
      });
    });

    // Second mock fetch for scenario2 - returns immediately
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        json: async () => mockScenario2,
      });
    });

    const { result, rerender } = renderHook((props) => useDemoScenario(props.scenarioName), {
      initialProps: { scenarioName: 'scenario1' },
    });

    // Quick change to scenario2 before the first fetch completes
    rerender({ scenarioName: 'scenario2' });

    // Run all timers to complete any pending operations
    await vi.runAllTimersAsync();

    // Should have loaded scenario2 and not scenario1
    expect(result.current.total).toBe(2);
    expect(result.current.events.length).toBe(1); // First event fires immediately

    // Advance to trigger second event
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Check that the right events were loaded
    expect(result.current.events.length).toBe(2);

    // Check that fetch was called twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('properly cleans up timers when unmounted', async () => {
    // Mock a successful fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockScenario1,
    });

    const { result, unmount } = renderHook(() => useDemoScenario('test-scenario'));

    // Wait for fetch to complete
    await vi.runAllTimersAsync();

    // First event should fire immediately
    expect(result.current.events.length).toBe(1);

    // Unmount the hook
    unmount();

    // Advance timers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // No additional events should have been added since we unmounted
    expect(result.current.events.length).toBe(1);
  });

  it('handles scenario change correctly', async () => {
    // Mock a successful fetch for two different scenarios
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScenario1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScenario2,
      });

    const { result, rerender } = renderHook((props) => useDemoScenario(props.scenarioName), {
      initialProps: { scenarioName: 'scenario1' },
    });

    // Wait for fetch and initial event
    await vi.runAllTimersAsync();

    // First event should fire immediately
    expect(result.current.events.length).toBe(1);
    expect(result.current.events[0].id).toContain('acct_test1');

    // Change scenario
    rerender({ scenarioName: 'scenario2' });

    // Wait for fetch and initial event of new scenario
    await vi.runAllTimersAsync();

    // Should have reset events and loaded first event of new scenario
    expect(result.current.events.length).toBe(1);
    expect(result.current.events[0].id).toContain('acct_test2');
  });
});
