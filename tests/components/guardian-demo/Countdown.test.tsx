import { render, screen, act } from '@testing-library/react';
import { Countdown } from '../Countdown';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays the initial time in mm:ss format', () => {
    render(<Countdown totalMs={12000} isRunning={false} />);
    expect(screen.getByText('00:12 remaining')).toBeInTheDocument();
  });

  it('does not count down when isRunning is false', () => {
    render(<Countdown totalMs={12000} isRunning={false} />);

    // Advance timer by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Time should still be 00:12
    expect(screen.getByText('00:12 remaining')).toBeInTheDocument();
  });

  it('counts down when isRunning is true', () => {
    render(<Countdown totalMs={12000} isRunning={true} />);

    // Advance timer by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Time should now be 00:11
    expect(screen.getByText('00:11 remaining')).toBeInTheDocument();

    // Advance by 5 more seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Time should now be 00:06
    expect(screen.getByText('00:06 remaining')).toBeInTheDocument();
  });

  it('stops at 00:00 and does not go negative', () => {
    render(<Countdown totalMs={5000} isRunning={true} />);

    // Advance timer by more than 5 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Time should be 00:00
    expect(screen.getByText('00:00 remaining')).toBeInTheDocument();
  });

  it('updates when totalMs changes', () => {
    const { rerender } = render(<Countdown totalMs={12000} isRunning={true} />);

    // Advance timer by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Time should now be 00:10
    expect(screen.getByText('00:10 remaining')).toBeInTheDocument();

    // Change totalMs to represent 2× speed
    rerender(<Countdown totalMs={5000} isRunning={true} />);

    // Time should now be 00:05
    expect(screen.getByText('00:05 remaining')).toBeInTheDocument();
  });
});
