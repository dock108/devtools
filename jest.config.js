/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1', // Handle path aliases like @/
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
      statements: 80
    }
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },
}; 