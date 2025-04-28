import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const program = new Command();

program
  .name('create-rule-set')
  .description('CLI tool to insert or update a Guardian rule set in Supabase')
  .requiredOption('-n, --name <name>', "Name of the rule set (e.g., 'high-risk-merchants')")
  .requiredOption(
    '-f, --file <path>',
    'Path to the JSON file containing the rule set configuration',
  )
  .option('-u, --update', 'Update the rule set if a set with the same name already exists')
  .parse(process.argv);

const options = program.opts();

// --- Supabase Client ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL or Service Role Key not found in environment variables.');
  console.error(
    'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Main Logic ---
async function main() {
  console.log(`Processing rule set '${options.name}' from file '${options.file}'...`);

  // 1. Read and parse the JSON file
  let configJson: object;
  try {
    const filePath = path.resolve(process.cwd(), options.file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    configJson = JSON.parse(fileContent);
    console.log('Successfully parsed JSON config file.');
  } catch (error: any) {
    console.error(`Error reading or parsing JSON file at ${options.file}:`, error.message);
    process.exit(1);
  }

  // 2. Prepare data for upsert
  const ruleSetData = {
    name: options.name,
    config: configJson,
  };

  // 3. Insert or Update in Supabase
  try {
    let resultData: any;
    let resultError: any;

    if (options.update) {
      console.log(`Attempting to update rule set '${options.name}'...`);
      const { data, error } = await supabase
        .from('rule_sets')
        .update(ruleSetData)
        .eq('name', options.name)
        .select('id, name, updated_at')
        .single();
      resultData = data;
      resultError = error;
      if (error && error.code !== 'PGRST116') {
        // Ignore 'No rows found' error for update unless specified
        throw error;
      }
      if (!data && !error) {
        console.warn(
          `Warning: Rule set '${options.name}' not found for updating. Use insert without --update?`,
        );
        process.exit(0);
      }
    } else {
      console.log(`Attempting to insert rule set '${options.name}'...`);
      const { data, error } = await supabase
        .from('rule_sets')
        .insert(ruleSetData)
        .select('id, name, created_at')
        .single();
      resultData = data;
      resultError = error;
      if (error) throw error;
    }

    if (resultData) {
      console.log('\n✅ Success!');
      console.log(`Rule Set Name: ${resultData.name}`);
      console.log(`Rule Set ID:   ${resultData.id}`);
      if (options.update) {
        console.log(`Updated At:    ${resultData.updated_at}`);
      } else {
        console.log(`Created At:    ${resultData.created_at}`);
      }
      console.log(
        '\nUse the Rule Set ID above to link accounts via connected_accounts.rule_set_id.',
      );
    } else if (!options.update) {
      // Should have thrown error if insert failed
      console.error('\n❌ Insert operation did not return data, but no error reported.');
    }
  } catch (error: any) {
    console.error('\n❌ Supabase operation failed:');
    console.error(`Code: ${error.code || 'N/A'}`);
    console.error(`Message: ${error.message}`);
    console.error(`Details: ${error.details || 'N/A'}`);
    console.error(`Hint: ${error.hint || 'N/A'}`);
    if (error.code === '23505') {
      // unique_violation
      console.error(
        `\nHint: A rule set with the name '${options.name}' might already exist. Use --update flag to overwrite.`,
      );
    }
    process.exit(1);
  }
}

main();
