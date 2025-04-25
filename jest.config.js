/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // Setup file for environment variables
  setupFilesAfterEnv: ['<rootDir>/jest.setup-env.ts'],
  // Ignore patterns for tests
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/e2e/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/alert-dispatch.integration.test.ts',
    '<rootDir>/components/guardian-demo/__tests__/Countdown.test.tsx',
    '<rootDir>/components/guardian-demo/__tests__/ScenarioPicker.test.tsx',
    '<rootDir>/lib/__tests__/stripe.test.ts',
    '<rootDir>/app/guardian-demo/__tests__/scenarios.test.ts',
    '<rootDir>/app/guardian-demo/__tests__/useDemoScenario.test.ts',
    '<rootDir>/app/guardian-demo/__tests__/useDemoScenario.timers.test.ts',
  ],
  // Transformation ignore patterns
  transformIgnorePatterns: ['/node_modules/(?!uuid)/', '^.+\.module\.(css|sass|scss)$'],
  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1', // Handle path aliases like @/
    // Handle CSS Modules (if used, though likely handled by Next.js config elsewhere)
    '^.+\.module\.(css|sass|scss)$': 'identity-obj-proxy',
    uuid: require.resolve('uuid'),
  },
  // Collect coverage from specific directories
  collectCoverageFrom: [
    'lib/guardian/rules.ts',
    'lib/guardian/alerts.ts',
    'supabase/functions/**/*.ts',
    'supabase/functions/**/*.js',
    '!supabase/functions/**/*.d.ts',
    '!supabase/functions/**/node_modules/**',
  ],
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
    'supabase/functions/**': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'lib/guardian/rules.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },
};
