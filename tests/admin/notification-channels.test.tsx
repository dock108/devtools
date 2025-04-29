import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { NotificationChannelActions } from '@/app/admin/notification-channels/notification-channel-actions';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from '@/components/ui/use-toast';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';

// Mock dependencies using vi
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

// Type cast mocks
const useRouterMock = useRouter as Mock;
const createClientComponentClientMock = createClientComponentClient as Mock;
const toastMock = toast as Mock;

describe('NotificationChannelActions', () => {
  const mockRouter = { refresh: vi.fn() };
  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    contains: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue(mockRouter);
    createClientComponentClientMock.mockReturnValue(mockSupabaseClient);
  });

  it('renders the action button', () => {
    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens delete dialog when delete option is clicked', async () => {
    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);
    const triggerButton = screen.getByRole('button');
    fireEvent.click(triggerButton);

    // Wait directly for the Delete menu item
    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteMenuItem);

    // Now wait for and verify the AlertDialog
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Are you sure\?/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Test Channel/)).toBeInTheDocument();
  });

  it('prevents deletion if channel is in use', async () => {
    (mockSupabaseClient.contains as Mock).mockResolvedValue({
      data: [{ id: 'rule1', name: 'Test Rule Set' }],
      error: null,
    });

    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);
    const triggerButton = screen.getByRole('button');
    fireEvent.click(triggerButton);

    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteMenuItem);

    const dialog = await screen.findByRole('alertdialog');
    const confirmDeleteButton = within(dialog).getByRole('button', { name: /delete/i });
    fireEvent.click(confirmDeleteButton);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cannot delete channel',
        variant: 'destructive',
      }),
    );
    expect(mockSupabaseClient.delete).not.toHaveBeenCalled();
  });

  it('deletes channel when confirmed and not in use', async () => {
    (mockSupabaseClient.contains as Mock).mockResolvedValue({ data: [], error: null });
    (mockSupabaseClient.delete as Mock).mockResolvedValue({ error: null });

    render(<NotificationChannelActions channelId="123" channelName="Test Channel" />);
    const triggerButton = screen.getByRole('button');
    fireEvent.click(triggerButton);

    const deleteMenuItem = await screen.findByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteMenuItem);

    const dialog = await screen.findByRole('alertdialog');
    const confirmDeleteButton = within(dialog).getByRole('button', { name: /delete/i });
    fireEvent.click(confirmDeleteButton);

    // Use waitFor to ensure async operations complete before assertions
    await waitFor(() => {
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Channel deleted',
        }),
      );
    });
    await waitFor(() => {
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
  });
});
