module.exports = {
  // Test environment for Node.js serverless functions
  testEnvironment: 'node',

  // Setup environment variables for tests
  setupFiles: ['<rootDir>/jest.setup.js'],

  // Coverage collection settings
  collectCoverageFrom: [
    'api/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],

  // Coverage threshold (optional - uncomment and adjust as needed)
  // coverageThreshold: {
  //   global: {
  //     branches: 70,
  //     functions: 70,
  //     lines: 70,
  //     statements: 70
  //   }
  // },

  // Verbose output
  verbose: true
};
