import { redirect } from 'next/navigation';

// This page component simply redirects from the old /settings/accounts path
// to the new unified /settings page.
export default function LegacySettingsAccountsRedirect() {
  redirect('/settings');
}
