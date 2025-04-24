import { NextApiRequest, NextApiResponse } from 'next';
import { spawnSync } from 'child_process';
import path from 'path';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Running timewarp-seeder.mjs with Node.js...');

    // Get the absolute path to the script
    const scriptPath = path.resolve(process.cwd(), 'scripts/timewarp-seeder.mjs');

    // Run the script directly with Node.js
    const out = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      env: process.env,
      stdio: 'pipe', // Capture output instead of inheriting
    });

    if (out.status === 0) {
      console.log('Seeder executed successfully');
      console.log('stdout >>>\n', out.stdout);
      return res.status(200).json({ ok: true, message: 'Seeder executed successfully' });
    } else {
      console.error('Seeder exit code:', out.status);
      console.error('stdout >>>\n', out.stdout);
      console.error('stderr >>>\n', out.stderr);
      return res.status(500).json({
        ok: false,
        error: 'Seeder execution failed',
        status: out.status,
        stdout: out.stdout,
        stderr: out.stderr,
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res
      .status(500)
      .json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
