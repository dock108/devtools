module.exports = {
  ci: {
    collect: {
      // URLs to run Lighthouse on
      url: [
        'http://localhost:3000/blog', // Blog index page
        // Add URLs for specific blog posts if desired, e.g.:
        // 'http://localhost:3000/blog/2024-11-stripe-guardian-origin'
      ],
      // Command to start your Next.js app in production mode
      startServerCommand: 'npm run start', // Assumes `next start` is mapped to `npm run start`
      // Pattern Lighthouse CI waits for in server logs before starting tests
      startServerReadyPattern: 'started server on',
      // Optional: Number of runs for each URL
      // numberOfRuns: 3,
    },
    assert: {
      // Assertions based on Lighthouse categories
      assertions: {
        // Performance: Score >= 90 is required (error if lower)
        'categories:performance': ['error', { minScore: 0.9 }],
        // Accessibility: Score >= 95 is required (error if lower)
        'categories:accessibility': ['error', { minScore: 0.95 }],
        // SEO: Score >= 90 is required (warning if lower)
        'categories:seo': ['warn', { minScore: 0.9 }],
        // Best Practices: Score >= 90 is required (warning if lower)
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        // PWA category check (optional, remove if not a PWA)
        // 'categories:pwa': ['warn', { minScore: 0.9 }],

        // Specific audit examples (optional):
        // 'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        // 'interactive': ['warn', { maxNumericValue: 3500 }],
        // 'uses-responsive-images': 'off', // Turn off specific check if needed
      },
    },
    upload: {
      // Where to upload the results
      target: 'temporary-public-storage', // Easiest option for PR checks
      // Other targets: 'lhci', 'filesystem' (requires configuration)
    },
    // server: {
    // Optional: Configure server options if needed
    // },
    // wizard: {
    // Optional: Configure wizard options
    // }
  },
};
