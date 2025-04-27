import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { Database, Json } from '@/types/supabase';
import { z } from 'zod';

// Zod schema for basic JSON object validation (can be refined)
const ruleSetConfigSchema = z
  .record(z.any())
  .refine((val) => typeof val === 'object' && val !== null && !Array.isArray(val), {
    message: 'Rule config must be a valid JSON object.',
  });

// Zod schema for POST/PUT payload
const ruleSetPayloadSchema = z.object({
  id: z.string().uuid().optional(), // Optional for POST, required for PUT
  name: z.string().min(1, { message: 'Rule set name cannot be empty.' }),
  config: ruleSetConfigSchema,
});

// Helper function to check admin role
async function checkAdmin(
  supabase: ReturnType<typeof createRouteHandlerClient<Database>>,
): Promise<boolean> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return false;
  }
  // Adjust based on where the role is stored (e.g., user.app_metadata?.role)
  return user.app_metadata?.role === 'admin';
}

// GET: Fetch all rule sets
export async function GET(/* request: Request */) {
  console.log('GET /api/admin/rule-sets called');
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabase.from('rule_sets').select('*').order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching rule sets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule sets', details: error.message },
      { status: 500 },
    );
  }
}

// POST: Create a new rule set
export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validation = ruleSetPayloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    const { name, config } = validation.data;

    // Prevent creating another rule set named 'default' (case-insensitive check)
    if (name.toLowerCase() === 'default') {
      return NextResponse.json(
        { error: "Cannot create another rule set named 'default'." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('rule_sets')
      .insert({ name, config: config as Json })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating rule set:', error);
    if (error.code === '23505') {
      // Unique constraint violation (e.g., name)
      return NextResponse.json({ error: 'Rule set name already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create rule set', details: error.message },
      { status: 500 },
    );
  }
}

// PUT: Update an existing rule set
export async function PUT(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    // Add id validation for PUT
    const validation = ruleSetPayloadSchema
      .extend({
        id: z.string().uuid({ message: 'Valid Rule Set ID is required for update.' }),
      })
      .safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 },
      );
    }

    const { id, name, config } = validation.data;

    // Prevent renaming the 'default' rule set or renaming another TO 'default'
    if (id) {
      const { data: existingRuleSet, error: fetchError } = await supabase
        .from('rule_sets')
        .select('name')
        .eq('id', id)
        .single();

      if (fetchError || !existingRuleSet) {
        return NextResponse.json({ error: 'Rule set not found' }, { status: 404 });
      }

      if (existingRuleSet.name === 'default' && name !== 'default') {
        return NextResponse.json(
          { error: "Cannot rename the 'default' rule set." },
          { status: 400 },
        );
      }
      if (existingRuleSet.name !== 'default' && name.toLowerCase() === 'default') {
        return NextResponse.json(
          { error: "Cannot rename a rule set to 'default'." },
          { status: 400 },
        );
      }
    }

    const { data, error } = await supabase
      .from('rule_sets')
      .update({ name, config: config as Json })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'Rule set not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating rule set:', error);
    if (error.code === '23505') {
      // Unique constraint violation (e.g., name)
      return NextResponse.json({ error: 'Rule set name already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to update rule set', details: error.message },
      { status: 500 },
    );
  }
}

// DELETE: Delete a rule set
export async function DELETE(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  const isAdmin = await checkAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Valid Rule Set ID is required' }, { status: 400 });
  }

  try {
    // Check if it's the 'default' rule set before deleting
    const { data: ruleSet, error: fetchError } = await supabase
      .from('rule_sets')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ error: 'Rule set not found' }, { status: 404 });
      }
      throw fetchError; // Other fetch error
    }

    if (ruleSet?.name === 'default') {
      return NextResponse.json({ error: "Cannot delete the 'default' rule set." }, { status: 400 });
    }

    // TODO: Check if the rule set is currently assigned to any accounts before deleting?
    // This might require querying the `accounts` table (or wherever rule sets are assigned).
    // If assigned, return a 409 Conflict or similar error.

    const { error: deleteError } = await supabase.from('rule_sets').delete().eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ message: 'Rule set deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting rule set:', error);
    return NextResponse.json(
      { error: 'Failed to delete rule set', details: error.message },
      { status: 500 },
    );
  }
}
