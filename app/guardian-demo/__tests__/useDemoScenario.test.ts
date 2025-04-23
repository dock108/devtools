import { renderHook, act } from '@testing-library/react';
import { useDemoScenario } from '../useDemoScenario';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Mock timer
vi.useFakeTimers();

describe('useDemoScenario', () => {
  const mockScenario = [
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
    },
    {
      delayMs: 3000,
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
    // Mock successful fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockScenario
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads and plays a scenario', async () => {
    const { result } = renderHook(() => useDemoScenario('test-scenario'));

    // Wait for fetch to complete
    await vi.runAllTimersAsync();
    
    // Check initial state after loading
    expect(result.current.events).toEqual([]);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.total).toBe(3);
    
    // Advance timers to trigger events
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // First event should be triggered immediately (delayMs: 0)
    expect(result.current.events.length).toBe(1);
    expect(result.current.events[0].type).toBe('account.updated');
    expect(result.current.currentIndex).toBe(1);
    
    // Advance to second event
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    
    expect(result.current.events.length).toBe(2);
    expect(result.current.events[1].type).toBe('payout.paid');
    expect(result.current.events[1].amount).toBe(1000);
    expect(result.current.currentIndex).toBe(2);
    
    // Advance to third event
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    
    expect(result.current.events.length).toBe(3);
    expect(result.current.events[2].type).toBe('payout.paid');
    expect(result.current.events[2].amount).toBe(2000);
    expect(result.current.currentIndex).toBe(3);
  });

  it('handles restart function', async () => {
    const { result } = renderHook(() => useDemoScenario('test-scenario'));

    // Wait for fetch to complete
    await vi.runAllTimersAsync();
    
    // Play through all events
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3001);
    });
    
    expect(result.current.events.length).toBe(3);
    
    // Call restart
    act(() => {
      result.current.restart();
    });
    
    // Events should be cleared
    expect(result.current.events.length).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    
    // First event should appear after advancing time
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    
    expect(result.current.events.length).toBe(1);
  });

  it('handles fetch error', async () => {
    // Mock fetch error
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() => useDemoScenario('test-scenario'));
    
    // Wait for fetch to complete
    await vi.runAllTimersAsync();
    
    expect(result.current.error).toBe('Network error');
    expect(result.current.events.length).toBe(0);
  });
}); 