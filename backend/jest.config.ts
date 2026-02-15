import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Prevent loading real DB/Redis connections during unit tests
  moduleNameMapper: {
    '^../utils/dbInstance$': '<rootDir>/__tests__/__mocks__/dbInstance.ts',
    '^../utils/redisInstance$': '<rootDir>/__tests__/__mocks__/redisInstance.ts',
    '^../../utils/dbInstance$': '<rootDir>/__tests__/__mocks__/dbInstance.ts',
    '^../../utils/redisInstance$': '<rootDir>/__tests__/__mocks__/redisInstance.ts',
    '^../models$': '<rootDir>/__tests__/__mocks__/models.ts',
    '^../../models$': '<rootDir>/__tests__/__mocks__/models.ts',
    '^../models/index$': '<rootDir>/__tests__/__mocks__/models.ts',
    '^../../models/index$': '<rootDir>/__tests__/__mocks__/models.ts',
  },
  // Don't load .env automatically
  setupFiles: [],
  verbose: true,
  testTimeout: 10000,
};

export default config;
