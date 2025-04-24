/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export default async function handler(req, res) {
  try {
    console.log('Starting timewarp-seeder directly from API handler...');

    // Use dynamic import to load the module
    const { runSeeder } = await import('../../dist/lib/timewarp-seeder.js');
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
