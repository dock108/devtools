// tests/ui/NotificationStatus.test.tsx
import { render, screen } from '@testing-library/react';
import NotificationStatus from '@/components/alerts/NotificationStatus';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import useSWR, { mutate } from 'swr'; // Import directly

// Mock the SWR module
vi.mock('swr');

// Type cast the mocked hook for easier use
const useSWRMock = useSWR as Mock;
// Keep the real mutate function if needed, or mock it
const mutateMock = mutate as Mock | undefined; // Or vi.fn() if needs mocking

describe('NotificationStatus Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    useSWRMock.mockClear();
    if (mutateMock) mutateMock.mockClear();
  });

  it('should display loading state initially', () => {
    useSWRMock.mockReturnValue({ data: undefined, error: null, isLoading: true });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(screen.getByText(/Loading notification status.../i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display error state', () => {
    const error = new Error('Fetch failed');
    useSWRMock.mockReturnValue({ data: undefined, error: error, isLoading: false });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(screen.getByText(/Error loading status./i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display nothing found message when status is null', () => {
    useSWRMock.mockReturnValue({ data: { deliveryStatus: null }, error: null, isLoading: false });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(screen.getByText(/No notification status tracked./i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display nothing found message when status is empty object', () => {
    useSWRMock.mockReturnValue({ data: { deliveryStatus: {} }, error: null, isLoading: false });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(screen.getByText(/No notification status tracked./i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display delivered status for email and slack', async () => {
    useSWRMock.mockReturnValue({
      data: { deliveryStatus: { email: 'delivered', slack: 'delivered' } },
      error: null,
      isLoading: false,
    });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(await screen.findByText(/Email: Delivered/i)).toBeInTheDocument();
    expect(await screen.findByText(/Slack: Delivered/i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display failed status correctly', async () => {
    useSWRMock.mockReturnValue({
      data: { deliveryStatus: { email: 'failed' } },
      error: null,
      isLoading: false,
    });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(await screen.findByText(/Email: Failed/i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display not_configured status correctly', async () => {
    useSWRMock.mockReturnValue({
      data: { deliveryStatus: { slack: 'not_configured' } },
      error: null,
      isLoading: false,
    });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(await screen.findByText(/Slack: Not Configured/i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  it('should display unknown status correctly', async () => {
    useSWRMock.mockReturnValue({
      data: { deliveryStatus: { email: 'some_weird_status' } },
      error: null,
      isLoading: false,
    });
    render(<NotificationStatus alertId="123" isAdmin={false} />);
    expect(await screen.findByText(/Email: Unknown/i)).toBeInTheDocument();
    expect(useSWRMock).toHaveBeenCalledWith(
      '/api/alerts/123/notification-status',
      expect.any(Function),
      expect.any(Object),
    );
  });

  // TODO: Add test for retry link visibility
  // TODO: Test retry button functionality (requires mocking fetch and mutate)
});
