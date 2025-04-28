// tests/ui/NotificationStatus.test.tsx
import { render, screen } from '@testing-library/react';
import NotificationStatus from '@/components/alerts/NotificationStatus';
import { describe, it, expect } from 'vitest';

describe('NotificationStatus Component', () => {
  it('should display nothing if status is null or empty', () => {
    render(<NotificationStatus deliveryStatus={null} />);
    expect(screen.queryByText('Notification Status')).not.toBeInTheDocument();
    render(<NotificationStatus deliveryStatus={{}} />);
    expect(screen.queryByText('Notification Status')).not.toBeInTheDocument();
  });

  it('should display delivered status for email and slack', () => {
    render(<NotificationStatus deliveryStatus={{ email: 'delivered', slack: 'delivered' }} />);
    expect(screen.getByText(/Email: Delivered/i)).toBeInTheDocument();
    expect(screen.getByText(/Slack: Delivered/i)).toBeInTheDocument();
    // Check for icons if necessary (e.g., by testing for SVG title or class)
  });

  it('should display failed status correctly', () => {
    render(<NotificationStatus deliveryStatus={{ email: 'failed' }} />);
    expect(screen.getByText(/Email: Failed/i)).toBeInTheDocument();
  });

  it('should display not_configured status correctly', () => {
    render(<NotificationStatus deliveryStatus={{ slack: 'not_configured' }} />);
    expect(screen.getByText(/Slack: Not Configured/i)).toBeInTheDocument();
  });

  it('should display unknown status correctly', () => {
    render(<NotificationStatus deliveryStatus={{ email: 'some_weird_status' }} />);
    expect(screen.getByText(/Email: Unknown/i)).toBeInTheDocument();
  });

  // TODO: Add test for retry link visibility (requires mocking isAdmin prop)
  // it('should display retry link for failed status if admin', () => {
  //   render(<NotificationStatus deliveryStatus={{ email: 'failed' }} isAdmin={true} />);
  //   expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  // });

  // it('should not display retry link if not admin', () => {
  //   render(<NotificationStatus deliveryStatus={{ email: 'failed' }} isAdmin={false} />);
  //   expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  // });
});
