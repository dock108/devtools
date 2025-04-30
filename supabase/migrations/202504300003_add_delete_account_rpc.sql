-- Function to delete a connected account and its associated alerts
create or replace function public.delete_account(p_account_id text) -- Use text for stripe_account_id
returns void language sql security definer as $$
  -- Ensure RLS is checked implicitly via the WHERE clause referencing stripe_account_id
  -- Delete associated alerts first based on stripe_account_id
  delete from public.alerts where stripe_account_id = p_account_id;
  -- Delete the account itself
  delete from public.connected_accounts where stripe_account_id = p_account_id;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.delete_account(text) to authenticated; 