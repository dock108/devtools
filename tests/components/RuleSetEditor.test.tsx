import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RuleSetEditor } from '@/components/accounts/RuleSetEditor';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

// Mock dependencies using vi
vi.mock('@/utils/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Convert createClient to Mock type for TypeScript
const createClientMock = createClient as Mock;

// Remove .skip to enable the test suite
describe('RuleSetEditor', () => {
  const mockAccountId = 'acct_123';
  // Define the mock Supabase client structure with vi.fn()
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  };

  beforeEach(() => {
    // Clear mocks using vi
    vi.clearAllMocks();
    // Configure the mock return value
    createClientMock.mockReturnValue(mockSupabase);
  });

  it('renders the edit thresholds button', () => {
    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    expect(button).toBeInTheDocument();
  });

  it('opens dialog when button is clicked', async () => {
    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rule Set Configuration')).toBeInTheDocument();
  });

  it('shows default config when no rule set is provided', async () => {
    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    // Find and cast textarea
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    // Check the .value property directly
    expect(textarea.value).toEqual(expect.stringContaining('"velocityBreach"'));
    expect(textarea.value).toEqual(expect.stringContaining('"maxPayouts": 3'));
  });

  it('shows custom rule set when provided', async () => {
    const customRuleSet = {
      velocityBreach: { maxPayouts: 5, windowSeconds: 120 },
    };

    render(<RuleSetEditor accountId={mockAccountId} ruleSet={customRuleSet} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    // Find and cast textarea
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    // Check the .value property directly
    expect(textarea.value).toEqual(expect.stringContaining('"maxPayouts": 5'));
    expect(textarea.value).toEqual(expect.stringContaining('"windowSeconds": 120'));
  });

  it('validates and saves valid JSON', async () => {
    // Mock the eq function specifically for this test case
    (mockSupabase.eq as Mock).mockResolvedValue({ error: null });

    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({
          velocityBreach: { maxPayouts: 5, windowSeconds: 120 },
          bankSwap: { lookbackMinutes: 10, minPayoutUsd: 500 },
          geoMismatch: { mismatchChargeCount: 1 },
        }),
      },
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('connected_accounts');
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_account_id', mockAccountId);
      expect(toast.success).toHaveBeenCalledWith('Rule set saved successfully');
    });
  });

  it('shows error for invalid JSON', async () => {
    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: '{ invalid json' },
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  it('shows error for schema violations', async () => {
    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    // Valid JSON but missing required properties according to schema
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: '{ "velocityBreach": { "maxPayouts": 0 } }' }, // maxPayouts=0 violates schema >= 1
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid rule set'));
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  it('resets to default when reset button is clicked', async () => {
    render(<RuleSetEditor accountId={mockAccountId} ruleSet={null} />);

    const button = screen.getByRole('button', { name: /edit thresholds/i });
    fireEvent.click(button);

    // Find and cast textarea
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{}' } });

    const resetButton = screen.getByRole('button', { name: /reset to default/i });
    fireEvent.click(resetButton);

    // Check the .value property directly after reset
    expect(textarea.value).toEqual(expect.stringContaining('"velocityBreach"'));
    expect(toast.info).toHaveBeenCalledWith('Reset to default settings');
  });
});
