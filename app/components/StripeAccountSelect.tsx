'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database } from '@/types/supabase'; // Assuming Database types are available

// Define Account type based on usage (should match ConnectedAccount in analytics page)
type ConnectedAccount = Database['public']['Tables']['connected_accounts']['Row'];

interface StripeAccountSelectProps {
  accounts: ConnectedAccount[];
  selectedAccountId: string | null;
  onAccountChange: (accountId: string | null) => void;
}

const StripeAccountSelect: React.FC<StripeAccountSelectProps> = ({
  accounts,
  selectedAccountId,
  onAccountChange,
}) => {
  const handleValueChange = (value: string) => {
    // If the placeholder value is selected, treat it as null
    onAccountChange(value === 'placeholder' ? null : value);
  };

  return (
    <Select value={selectedAccountId ?? 'placeholder'} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select account..." />
      </SelectTrigger>
      <SelectContent>
        {accounts.length === 0 && (
          <SelectItem value="placeholder" disabled>
            No accounts found
          </SelectItem>
        )}
        {accounts.map((acc) => (
          <SelectItem key={acc.stripe_account_id} value={acc.stripe_account_id}>
            <div className="flex flex-col">
              {/* Display business name or ID */}
              <span className="font-medium">{acc.business_name || acc.stripe_account_id}</span>
              {acc.business_name && (
                <span className="text-xs text-slate-500 font-mono">{acc.stripe_account_id}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default StripeAccountSelect;
