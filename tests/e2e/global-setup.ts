import { exec } from 'child_process';
import { promisify } from 'util';
import { FullConfig } from '@playwright/test';

const execPromise = promisify(exec);

async function globalSetup(config: FullConfig) {
  // Temporarily disable Supabase startup for smoke tests
  /*
  if (!process.env.SUPABASE_URL) {
    try {
      console.log('Starting Supabase...');
      await execPromise('npx supabase start');
      console.log('Supabase started successfully');
    } catch (error) {
      console.error('Failed to start Supabase:', error);
      throw error;
    }
  }
  */
}

async function globalTeardown() {
  // Temporarily disable Supabase stop for smoke tests
  /*
  if (!process.env.SUPABASE_URL) {
    try {
      console.log('Stopping Supabase...');
      await execPromise('npx supabase stop');
      console.log('Supabase stopped successfully');
    } catch (error) {
      console.error('Failed to stop Supabase:', error);
    }
  }
  */
}

export default globalSetup;
export { globalTeardown };
