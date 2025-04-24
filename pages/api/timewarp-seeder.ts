import { NextApiRequest, NextApiResponse } from 'next';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // First check if ts-node is available
    const checkTsNode = spawnSync('which', ['ts-node'], { encoding: 'utf8' });
    
    // If ts-node is not found, install it globally
    if (checkTsNode.status !== 0) {
      console.log('ts-node not found, installing...');
      const install = spawnSync('npm', ['install', '-g', 'ts-node', 'typescript'], { 
        encoding: 'utf8',
        env: process.env 
      });
      
      if (install.status !== 0) {
        console.error('Failed to install ts-node:', install.stderr);
        console.log('Trying fallback approach...');
      } else {
        console.log('ts-node installed successfully');
      }
    }
    
    // Try running with npm script first
    console.log('Running seed:prod with npm...');
    const out = spawnSync('npm', ['run', 'seed:prod'], { 
      encoding: 'utf8', 
      env: process.env,
      stdio: 'inherit' // Display output in real-time in the function logs
    });

    // If npm run seed:prod fails, try direct approach
    if (out.status !== 0) {
      console.log('npm run failed, trying direct script execution...');
      
      // Get the absolute path to the script
      const scriptPath = path.resolve(process.cwd(), 'scripts/timewarp-seeder.ts');
      
      // Check if the script exists
      if (!fs.existsSync(scriptPath)) {
        console.error(`Script not found at ${scriptPath}`);
        return res.status(500).json({ 
          ok: false, 
          error: 'Script not found',
          path: scriptPath
        });
      }
      
      // Try running with ts-node directly
      console.log('Running script directly with ts-node...');
      const directRun = spawnSync('ts-node', [scriptPath], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GUARDIAN_ALPHA_SEED: '1' // Ensure safety flag is set
        },
        stdio: 'inherit'
      });
      
      if (directRun.status === 0) {
        return res.status(200).json({ ok: true, message: 'Seeder executed successfully via direct execution' });
      } else {
        console.error('Direct execution failed:', directRun.stderr);
        return res.status(500).json({ 
          ok: false, 
          error: 'Both npm and direct execution failed',
          stderr: directRun.stderr 
        });
      }
    }
    
    return res.status(200).json({ ok: true, message: 'Seeder executed successfully via npm' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
} 