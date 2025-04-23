import { renderHook, act } from '@testing-library/react';
import { useDemoScenario } from '../useDemoScenario';
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
  }
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
        object: 'account'
      }
    },
    {
      delayMs: 2000,
      type: 'payout.paid',
      payload: {
        id: 'po_test1',
        object: 'payout',
        amount: 1000
      }
    }
  ];
  
  const mockScenario2 = [
    {
      delayMs: 0,
      type: 'account.updated',
      payload: {
        id: 'acct_test2',
        object: 'account'
      }
    },
    {
      delayMs: 5000,
      type: 'payout.paid',
      payload: {
        id: 'po_test2',
        object: 'payout',
        amount: 2000
      }
    }
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
            json: async () => mockScenario1
          });
        }, 500); // Delayed response
      });
    });
    
    // Second mock fetch for scenario2 - returns immediately
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        json: async () => mockScenario2
      });
    });
    
    const { result, rerender } = renderHook(
      (props) => useDemoScenario(props.scenarioName), 
      { initialProps: { scenarioName: 'scenario1' } }
    );
    
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

  it('manages timers correctly when speed changes', async () => {
    // Mock a successful fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockScenario1
    });
    
    const { result, rerender } = renderHook(
      (props) => useDemoScenario(props.scenarioName, { speed: props.speed }), 
      { initialProps: { scenarioName: 'scenario1', speed: 1 } }
    );
    
    // Wait for fetch and initial event
    await vi.runAllTimersAsync();
    
    // First event should fire immediately
    expect(result.current.events.length).toBe(1);
    
    // Change speed to 2x before second event
    rerender({ scenarioName: 'scenario1', speed: 2 });
    
    // Advance timers - we expect the event to fire at 1000ms now (2000ms / 2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    
    // Second event should have fired with adjusted timing
    expect(result.current.events.length).toBe(2);
    
    // Verify we don't have any duplicate events
    expect(result.current.events[0].type).toBe('account.updated');
    expect(result.current.events[1].type).toBe('payout.paid');
  });

  it('maintains correct timer count during rapid speed toggles', async () => {
    // Mock a successful fetch with a scenario that has multiple events
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        { delayMs: 0, type: 'account.updated', payload: { id: 'acct1' } },
        { delayMs: 2000, type: 'payout.paid', payload: { id: 'po1', amount: 1000 } },
        { delayMs: 4000, type: 'payout.paid', payload: { id: 'po2', amount: 2000 } },
        { delayMs: 6000, type: 'payout.paid', payload: { id: 'po3', amount: 3000 } }
      ]
    });
    
    const { result, rerender } = renderHook(
      (props) => useDemoScenario(props.scenarioName, { speed: props.speed }), 
      { initialProps: { scenarioName: 'test-scenario', speed: 1 } }
    );
    
    // Wait for fetch and initial event
    await vi.runAllTimersAsync();
    
    // First event should fire immediately
    expect(result.current.events.length).toBe(1);
    
    // Rapid speed toggles
    rerender({ scenarioName: 'test-scenario', speed: 2 });
    rerender({ scenarioName: 'test-scenario', speed: 4 });
    rerender({ scenarioName: 'test-scenario', speed: 2 });
    
    // The timer count should match the number of pending events (3) plus expiry timer (1)
    expect(vi.getTimerCount()).toBe(4);
    
    // Advance to second event (originally 2000ms, but now at 2000/2 = 1000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    
    // Second event should have fired
    expect(result.current.events.length).toBe(2);
    
    // Timer count should be one less (3)
    expect(vi.getTimerCount()).toBe(3);
    
    // Rapid speed toggles again
    rerender({ scenarioName: 'test-scenario', speed: 1 });
    rerender({ scenarioName: 'test-scenario', speed: 0.5 });
    
    // Timer count should still match pending events (2) plus expiry timer (1)
    expect(vi.getTimerCount()).toBe(3);
    
    // No duplicate events should exist
    expect(result.current.events.length).toBe(2);
  });
}); 