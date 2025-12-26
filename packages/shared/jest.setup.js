// Jest setup file for global test configuration

// Mock crypto.randomUUID for consistent testing
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

// Set up test timeout
jest.setTimeout(10000);