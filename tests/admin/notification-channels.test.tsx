import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationChannelActions } from '@/app/admin/notification-channels/notification-channel-actions';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from '@/components/ui/use-toast';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(),
}));

jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

describe('NotificationChannelActions', () => {
  const mockRouter = { refresh: jest.fn() };
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    contains: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (createClientComponentClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  test('renders the action button', () => {
    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);

    // Verify the action button is rendered
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('opens delete dialog when delete option is clicked', async () => {
    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);

    // Click the action button to open the dropdown
    fireEvent.click(screen.getByRole('button'));

    // Click the delete option
    const deleteButton = await screen.findByText('Delete');
    fireEvent.click(deleteButton);

    // Verify the dialog is opened
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure\?/)).toBeInTheDocument();
    expect(screen.getByText(/Test Channel/)).toBeInTheDocument();
  });

  test('prevents deletion if channel is in use', async () => {
    // Mock rule sets data for a channel in use
    mockSupabaseClient.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockSupabaseClient.contains.mockResolvedValue({
      data: [{ id: 'rule1', name: 'Test Rule Set' }],
      error: null,
    });

    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);

    // Click the action button to open the dropdown
    fireEvent.click(screen.getByRole('button'));

    // Click the delete option
    const deleteButton = await screen.findByText('Delete');
    fireEvent.click(deleteButton);

    // Verify the dialog is opened
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Click the delete button in the dialog
    const confirmDeleteButton = screen.getByText('Delete', {
      selector: '[class*="AlertDialogAction"]',
    });
    fireEvent.click(confirmDeleteButton);

    // Verify toast is called with error message
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cannot delete channel',
        variant: 'destructive',
      }),
    );

    // Verify channel is not deleted
    expect(mockSupabaseClient.delete).not.toHaveBeenCalled();
  });

  test('deletes channel when confirmed and not in use', async () => {
    // Mock empty rule sets data (not in use)
    mockSupabaseClient.contains.mockResolvedValue({
      data: [],
      error: null,
    });

    mockSupabaseClient.delete.mockResolvedValue({
      error: null,
    });

    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);

    // Click the action button to open the dropdown
    fireEvent.click(screen.getByRole('button'));

    // Click the delete option
    const deleteButton = await screen.findByText('Delete');
    fireEvent.click(deleteButton);

    // Click the delete button in the dialog
    const confirmDeleteButton = screen.getByText('Delete', {
      selector: '[class*="AlertDialogAction"]',
    });
    fireEvent.click(confirmDeleteButton);

    // Verify delete is called
    expect(mockSupabaseClient.delete).toHaveBeenCalled();

    // Verify toast is called with success message
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Channel deleted',
      }),
    );

    // Verify router is refreshed
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
