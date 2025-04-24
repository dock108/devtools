import type { NextApiRequest, NextApiResponse } from 'next';
import { runSeeder } from '../../dist/lib/timewarp-seeder';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Starting timewarp-seeder directly from API handler...');
    const result = await runSeeder();

    if (!result) {
      // If runSeeder returns undefined, it means the safety flag was not set
      return res.status(200).json({
        ok: true,
        message: 'Seeder not run: GUARDIAN_ALPHA_SEED not set to "1"',
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Seeder executed successfully',
      result,
    });
  } catch (error) {
    console.error('Seeder execution failed:', error);
    return res.status(500).json({
      ok: false,
      error: 'Seeder execution failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
