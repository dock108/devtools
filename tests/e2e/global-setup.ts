import { exec } from 'child_process';
import { promisify } from 'util';
import { FullConfig } from '@playwright/test';

const execPromise = promisify(exec);

async function globalSetup(config: FullConfig) {
  // Only start Supabase if we're not already using it
  if (!process.env.SUPABASE_URL) {
    try {
      console.log('Starting Supabase...');
      await execPromise('npx supabase start -x');
      console.log('Supabase started successfully');
    } catch (error) {
      console.error('Failed to start Supabase:', error);
      throw error;
    }
  }
}

async function globalTeardown() {
  // Only stop Supabase if we started it
  if (!process.env.SUPABASE_URL) {
    try {
      console.log('Stopping Supabase...');
      await execPromise('npx supabase stop');
      console.log('Supabase stopped successfully');
    } catch (error) {
      console.error('Failed to stop Supabase:', error);
    }
  }
}

export default globalSetup;
export { globalTeardown };
