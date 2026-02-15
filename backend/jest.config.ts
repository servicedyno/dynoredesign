import type { Config } from 'jest';

// Shared DB/model mock mappings (used by all projects)
const dbModelMapper: Record<string, string> = {
  '^../utils/dbInstance$': '<rootDir>/__tests__/__mocks__/dbInstance.ts',
  '^../../utils/dbInstance$': '<rootDir>/__tests__/__mocks__/dbInstance.ts',
  '^../models$': '<rootDir>/__tests__/__mocks__/models.ts',
  '^../../models$': '<rootDir>/__tests__/__mocks__/models.ts',
  '^../models/index$': '<rootDir>/__tests__/__mocks__/models.ts',
  '^../../models/index$': '<rootDir>/__tests__/__mocks__/models.ts',
};

const config: Config = {
  projects: [
    // Default project: mocks Redis, DB, models
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/__tests__'],
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', 'redisInstance\\.test\\.ts$'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
      moduleNameMapper: {
        ...dbModelMapper,
        '^../utils/redisInstance$': '<rootDir>/__tests__/__mocks__/redisInstance.ts',
        '^../../utils/redisInstance$': '<rootDir>/__tests__/__mocks__/redisInstance.ts',
      },
      setupFiles: [],
      verbose: true,
      testTimeout: 10000,
    },
    // Redis project: tests the REAL redisInstance module with mocked redis client
    {
      displayName: 'redis',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/__tests__'],
      testMatch: ['**/redisInstance.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
      },
      moduleNameMapper: {
        ...dbModelMapper,
        // NOTE: redisInstance is NOT mocked here — tests the real module
      },
      setupFiles: [],
      verbose: true,
      testTimeout: 10000,
    },
  ],
};

export default config;
