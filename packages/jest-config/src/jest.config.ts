/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./",
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/**/index.ts"],
  moduleFileExtensions: ["ts", "js"],
  coverageReporters: ["json", "lcov", "html"],
  testMatch: ["<rootDir>/src/**/*.test.ts"]
};
