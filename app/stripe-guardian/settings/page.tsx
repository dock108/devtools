import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/stripe-guardian/settings/accounts');
} 