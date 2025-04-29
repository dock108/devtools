'use client';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// import { fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectedAccountsManager } from '@/app/(dashboard)/accounts/ConnectedAccountsManager';
import { SWRConfig } from 'swr';
import toast from 'react-hot-toast';

// Mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({}),
}));
vi.mock('@/app/(auth)/settings/connected-accounts/actions', () => ({
  linkStripeAccountServerAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// Mock fetch for SWR
global.fetch = vi.fn();

const mockAccounts = [
  {
    id: 'uuid-1',
    stripe_account_id: 'acct_123',
    status: 'active',
    created_at: new Date().toISOString(),
    rule_set_id: null,
    rule_set_name: 'Default',
    backfill_status: 'completed',
    backfill_progress: 100,
    backfill_error: null,
    backfill_updated_at: new Date().toISOString(),
    business_name: 'Test Business 1',
  },
  {
    id: 'uuid-2',
    stripe_account_id: 'acct_456',
    status: 'active',
    created_at: new Date().toISOString(),
    rule_set_id: 'ruleset-uuid-1',
    rule_set_name: 'High Risk',
    backfill_status: 'running',
    backfill_progress: 50,
    backfill_error: null,
    backfill_updated_at: new Date().toISOString(),
    business_name: 'Test Business 2',
  },
];

const mockRuleSets = [{ id: 'ruleset-uuid-1', name: 'High Risk' }];

describe('ConnectedAccountsManager Component', () => {
  const renderComponent = (
    props: Partial<React.ComponentProps<typeof ConnectedAccountsManager>> = {},
  ) => {
    // @ts-ignore
    fetch.mockResolvedValue({ ok: true, json: async () => mockAccounts });
    return render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ConnectedAccountsManager
          initialAccounts={mockAccounts}
          userRole="user"
          availableRuleSets={mockRuleSets}
          {...props}
        />
      </SWRConfig>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    fetch.mockClear();
  });

  it('renders the accounts table correctly', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Test Business 1')).toBeInTheDocument();
      expect(screen.getByText('acct_456')).toBeInTheDocument();
      // TODO: Add more assertions for table content
    });
    expect(true).toBe(false); // Placeholder
  });

  it('disables "Add Account" button when limit is reached', async () => {
    renderComponent({ initialAccounts: mockAccounts }); // 2 accounts
    await waitFor(() => {
      expect(screen.getByText('Add Stripe Account').closest('button')).toBeDisabled();
    });
    // Check tooltip?
    expect(true).toBe(false); // Placeholder
  });

  it('calls disconnect action when confirmed', async () => {
    // @ts-ignore
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockAccounts }); // Initial fetch
    // @ts-ignore
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Success' }) }); // DELETE fetch

    renderComponent();
    // TODO: Find disconnect button for acct_123, click it
    // TODO: Find confirm button in dialog, click it
    // await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/accounts/acct_123', { method: 'DELETE' }));
    expect(true).toBe(false); // Placeholder
  });

  it('shows rule set dropdown for admin users', async () => {
    renderComponent({ userRole: 'admin' });
    await waitFor(() => {
      // Check if SelectTrigger is present (might need specific selector)
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
    });
    expect(true).toBe(false); // Placeholder
  });

  it('shows read-only rule set badge for non-admin users', async () => {
    renderComponent({ userRole: 'user' });
    await waitFor(() => {
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });
    expect(true).toBe(false); // Placeholder
  });

  it('calls patch action when admin changes rule set', async () => {
    // @ts-ignore
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockAccounts }); // Initial fetch
    // @ts-ignore
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Success' }) }); // PATCH fetch

    renderComponent({ userRole: 'admin' });
    // TODO: Find select dropdown for acct_123, open it, select a new value
    // await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/accounts/acct_123', expect.objectContaining({ method: 'PATCH' })));
    expect(true).toBe(false); // Placeholder
  });

  // TODO: Add tests for mobile/card view rendering
  // TODO: Add tests for error states (API fetch errors, disconnect/patch errors)
});
