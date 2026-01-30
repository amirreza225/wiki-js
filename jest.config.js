module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/server/test/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dev/cypress/'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dev/cypress/'
  ]
}
