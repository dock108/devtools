import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export default function handler(req, res) {
  try {
    console.log('Running timewarp-seeder.mjs with Node.js...');

    // Get the absolute path to the script - going up from pages/api to project root, then to scripts
    const projectRoot = path.resolve(__dirname, '../../../');
    const scriptPath = path.join(projectRoot, 'scripts/timewarp-seeder.mjs');

    // Run the script directly with Node.js
    const out = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GUARDIAN_ALPHA_SEED: '1', // Ensure safety flag is set
      },
      stdio: 'inherit', // Display output in real-time in the function logs
    });

    if (out.status === 0) {
      return res.status(200).json({ ok: true, message: 'Seeder executed successfully' });
    } else {
      console.error('Seeder execution failed:', out.stderr);
      return res.status(500).json({
        ok: false,
        error: 'Seeder execution failed',
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
