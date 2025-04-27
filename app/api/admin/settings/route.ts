import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { z } from 'zod';

// Zod schema for settings payload validation
const settingsSchema = z.object({
  id: z.string().min(1), // Assuming a primary key like 'global_settings' or a UUID
  slack_webhook_url: z
    .string()
    .url({ message: 'Invalid Slack Webhook URL format.' })
    .or(z.literal(''))
    .nullable(),
  notification_emails: z
    .array(z.string().email({ message: 'Invalid email format found.' }))
    .nullable(),
  slack_notifications_enabled: z.boolean().nullable(),
  email_notifications_enabled: z.boolean().nullable(),
  // Add other settings fields here if needed
});

// Helper function to check admin role (can be shared/imported)
async function checkAdmin(
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>,
): Promise<boolean> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  return !userError && !!user && user.app_metadata?.role === 'admin';
}

const SETTINGS_ROW_ID = 'global_settings'; // Define a constant for the settings row ID

// GET: Fetch global settings
export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Attempt to fetch the specific settings row
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', SETTINGS_ROW_ID) // Use the constant ID
      .maybeSingle(); // Use maybeSingle as it might not exist initially

    if (error) throw error;

    // Return the found settings or an empty object if null (doesn't exist yet)
    return NextResponse.json(data || {});
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 },
    );
  }
}

// PUT: Update (or create) global settings
export async function PUT(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Ensure the ID matches the expected global ID
    if (body.id !== SETTINGS_ROW_ID) {
      return NextResponse.json(
        { error: `Invalid settings ID. Expected '${SETTINGS_ROW_ID}'.` },
        { status: 400 },
      );
    }

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    const validatedData = validation.data;

    // Upsert the settings using the constant ID
    const { data, error } = await supabase.from('settings').upsert(validatedData).select().single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings', details: error.message },
      { status: 500 },
    );
  }
}
