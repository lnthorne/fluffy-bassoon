/**
 * Jest setup file for server-specific test configuration
 * Requirements: 7.5, 7.6
 */

// Import shared setup
require('../../packages/shared/jest.setup.js');

// Import and setup playback mocks
const { setupPlaybackMocks } = require('./src/__tests__/setup/playback-mocks.ts');

// Set up playback system mocks
setupPlaybackMocks();

// Additional server-specific test configuration
jest.setTimeout(15000); // Longer timeout for integration tests

// Mock external executables for dependency validation
const mockWhich = jest.fn();
jest.mock('which', () => mockWhich);

// Set up default mock implementations
beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
  
  // Default: external dependencies are available
  mockWhich.mockImplementation(async (cmd) => {
    if (cmd === 'yt-dlp' || cmd === 'mpv') {
      return '/usr/local/bin/' + cmd;
    }
    throw new Error(`Command not found: ${cmd}`);
  });
});

// Global test utilities
global.testUtils = {
  mockDependencyMissing: (dependency) => {
    mockWhich.mockImplementation(async (cmd) => {
      if (cmd === dependency) {
        throw new Error(`Command not found: ${cmd}`);
      }
      if (cmd === 'yt-dlp' || cmd === 'mpv') {
        return '/usr/local/bin/' + cmd;
      }
      throw new Error(`Command not found: ${cmd}`);
    });
  },
  
  mockAllDependenciesMissing: () => {
    mockWhich.mockImplementation(async (cmd) => {
      throw new Error(`Command not found: ${cmd}`);
    });
  },
  
  restoreDependencies: () => {
    mockWhich.mockImplementation(async (cmd) => {
      if (cmd === 'yt-dlp' || cmd === 'mpv') {
        return '/usr/local/bin/' + cmd;
      }
      throw new Error(`Command not found: ${cmd}`);
    });
  }
};