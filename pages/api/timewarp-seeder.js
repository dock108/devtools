const { spawnSync } = require('child_process');

/**
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
module.exports = function handler(req, res) {
  const out = spawnSync('npm', ['run', 'seed:prod'], { encoding: 'utf8', env: process.env });

  if (out.status === 0) {
    res.status(200).json({ ok: true, stdout: out.stdout });
  } else {
    console.error(out.stderr);
    res.status(500).json({ ok: false, stderr: out.stderr });
  }
} 