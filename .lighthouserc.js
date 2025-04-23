/** @type {import('@lhci/cli').LHCIConfig} */
module.exports = {
  ci: {
    collect: {
      staticDistDir: './.next',
      numberOfRuns: 3,
      startServerCommand: 'pnpm start-preview',
      url: ['/', '/stripe-guardian', '/guardian-demo'],
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        performance: ['error', { minScore: 0.9 }],
        'resource-summary.total-byte-weight': ['error', { maxNumericValue: 200 * 1024 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
