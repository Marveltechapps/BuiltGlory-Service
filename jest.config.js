export default {
  testEnvironment: "node",
  setupFiles: ["dotenv/config"],
  testMatch: ["**/src/tests/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/server.js", "!src/docs/**", "!src/tests/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text-summary", "json-summary", "lcov"]
};