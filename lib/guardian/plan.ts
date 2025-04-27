import { Database } from '@/types/supabase';

// Assuming SettingsRow is the type for a row from the 'settings' table
// If using generated types, adjust the import path as needed.
// type SettingsRow = Database['public']['Tables']['settings']['Row'];

// Define a minimal type here if full DB type is not easily available or needed
// Ensure this matches the actual columns used (tier, slack_notifications_enabled etc.)
interface SettingsRow {
  tier?: string | null;
  slack_notifications_enabled?: boolean | null;
  // Add other relevant fields from the settings table if needed by helpers
}

/**
 * Checks if the provided settings indicate a Pro plan tier.
 * @param settings - The settings object for the user/account.
 * @returns True if the tier is 'pro', false otherwise.
 */
export const isPro = (settings: SettingsRow | null | undefined): boolean => {
  return settings?.tier === 'pro';
};

/**
 * Determines if Slack notifications can be sent based on settings.
 * Currently requires Pro tier AND Slack enabled in settings.
 * @param settings - The settings object for the user/account.
 * @returns True if Slack notifications should be sent, false otherwise.
 */
export const canSendSlack = (settings: SettingsRow | null | undefined): boolean => {
  // Check if settings exist, if it's a Pro plan, and if Slack is specifically enabled
  return !!settings && isPro(settings) && settings.slack_notifications_enabled === true;
};

/**
 * Gets the alert cap based on the user's plan tier.
 * @param settings - The settings object for the user/account.
 * @returns The maximum number of alerts allowed (e.g., 50 for free, Infinity for pro).
 */
export const alertCapFor = (settings: SettingsRow | null | undefined): number => {
  // Pro plan has no cap (Infinity), Free plan has a cap of 50
  return isPro(settings) ? Infinity : 50;
};

// Example usage:
// import { getSettings } from './settingsService'; // Assume a function to fetch settings
// import { isPro, canSendSlack, alertCapFor } from './plan';
//
// async function processAlerts(userId: string) {
//   const settings = await getSettings(userId);
//   const alertCap = alertCapFor(settings);
//   const allowSlack = canSendSlack(settings);
//
//   console.log(`User ${userId} isPro: ${isPro(settings)}`);
//   console.log(`Alert Cap: ${alertCap}`);
//   console.log(`Can send Slack: ${allowSlack}`);
//   // ... proceed with logic based on these values
// }
