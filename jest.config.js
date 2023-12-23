/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./",
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: [
    "<rootDir>/packages/**/src/**/*.ts",
    "!<rootDir>/packages/**/src/**/index.ts"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/**/node_modules",
    "<rootDir>/**/apps/*/dist",
    "<rootDir>/**/packages/*/dist"
  ],
  moduleFileExtensions: ["ts", "js"],
  coverageReporters: ["json", "lcov", "html"],
  projects: [
    {
      displayName: "liveness",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/apps/liveness/**/*.test.ts"]
    }
  ]
};
