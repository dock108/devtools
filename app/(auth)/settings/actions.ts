'use server';

import { updateProfile, updatePassword, generateApiKey, revokeApiKey } from '@/lib/supabase/user';
import { revalidatePath } from 'next/cache';

export async function updateProfileServerAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  // Define the type for the updates object expected by updateProfile
  // Adjust this type based on what updateProfile actually accepts
  const updates: { display_name?: string; avatar_url?: string; theme?: string } = {};

  const displayName = formData.get('display_name') as string;
  const avatarUrl = formData.get('avatar_url') as string;

  // Only add properties if they have a non-empty string value
  if (displayName) {
    updates.display_name = displayName;
  }
  if (avatarUrl) {
    updates.avatar_url = avatarUrl;
  }

  // Return early if no actual updates are present (optional)
  if (Object.keys(updates).length === 0) {
    return { success: true }; // No updates needed
  }

  // Pass the correctly formed object with only defined string values
  const result = await updateProfile(updates);
  if (result.success) {
    revalidatePath('/settings'); // Revalidate the page to show updated profile info
  }
  return result;
}

export async function updatePasswordServerAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const newPassword = formData.get('newPassword') as string;
  if (!newPassword) return { success: false, error: 'New password missing' };

  // Perform server-side validation again just in case
  if (newPassword.length < 12 || !/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
    return { success: false, error: 'Password does not meet requirements.' };
  }

  return await updatePassword(newPassword);
}

export async function generateApiKeyServerAction(
  formData: FormData,
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  const name = formData.get('keyName') as string;
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'API key name cannot be empty.' };
  }
  const result = await generateApiKey(name.trim());
  if (result.success) {
    revalidatePath('/settings'); // Revalidate to show the new key (minus full value)
  }
  return result;
}

export async function revokeApiKeyServerAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const keyId = formData.get('keyId') as string;
  if (!keyId) return { success: false, error: 'Key ID missing' };

  const result = await revokeApiKey(keyId);
  if (result.success) {
    revalidatePath('/settings'); // Revalidate to remove the key from the list
  }
  return result;
}
