/**
 * Test setup for external process mocking in playback system
 * Requirements: 7.5, 7.6
 */

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Mock ChildProcess for testing external processes
 */
export class MockChildProcess extends EventEmitter {
  public pid?: number = 12345;
  public exitCode: number | null = null;
  public killed = false;
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  public stdin = new EventEmitter();

  kill(signal?: string | number): boolean {
    this.killed = true;
    this.exitCode = 0;
    this.emit('exit', 0, signal);
    return true;
  }

  // Simulate process output
  simulateOutput(data: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    this[stream].emit('data', Buffer.from(data));
  }

  // Simulate process exit
  simulateExit(code: number = 0, signal?: string): void {
    this.exitCode = code;
    this.emit('exit', code, signal);
  }

  // Simulate process error
  simulateError(error: Error): void {
    this.emit('error', error);
  }
}

/**
 * Mock yt-dlp responses for testing
 */
export const mockYtDlpResponses = {
  success: {
    url: 'https://example.com/audio.opus',
    title: 'Test Song',
    duration: 180,
    format: 'opus',
    quality: 'best'
  },
  
  invalidUrl: {
    error: 'ERROR: Invalid URL format'
  },
  
  networkError: {
    error: 'ERROR: Network unreachable'
  },
  
  timeout: {
    error: 'ERROR: Timeout after 30 seconds'
  },
  
  extractionFailed: {
    error: 'ERROR: Video unavailable'
  }
};

/**
 * Mock MPV IPC responses for testing
 */
export const mockMpvResponses = {
  success: {
    data: null,
    error: 'success',
    request_id: 1
  },
  
  loadfile: {
    data: null,
    error: 'success',
    request_id: 1
  },
  
  pause: {
    data: true,
    error: 'success',
    request_id: 2
  },
  
  getPosition: {
    data: 45.5,
    error: 'success',
    request_id: 3
  },
  
  getDuration: {
    data: 180.0,
    error: 'success',
    request_id: 4
  },
  
  error: {
    data: null,
    error: 'command not found',
    request_id: 5
  }
};

/**
 * Mock Unix socket for MPV IPC testing
 */
export class MockUnixSocket extends EventEmitter {
  public connected = false;
  public destroyed = false;

  connect(path: string): void {
    setTimeout(() => {
      this.connected = true;
      this.emit('connect');
    }, 10);
  }

  write(data: string): boolean {
    if (!this.connected) {
      this.emit('error', new Error('Socket not connected'));
      return false;
    }

    // Simulate response based on command
    setTimeout(() => {
      try {
        const command = JSON.parse(data);
        let response: any = mockMpvResponses.success;
        
        if (command.command[0] === 'loadfile') {
          response = mockMpvResponses.loadfile;
        } else if (command.command[0] === 'set' && command.command[1] === 'pause') {
          response = mockMpvResponses.pause;
        } else if (command.command[0] === 'get_property' && command.command[1] === 'time-pos') {
          response = mockMpvResponses.getPosition;
        } else if (command.command[0] === 'get_property' && command.command[1] === 'duration') {
          response = mockMpvResponses.getDuration;
        }
        
        response = { ...response, request_id: command.request_id || 1 };
        this.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      } catch (error) {
        this.emit('error', error);
      }
    }, 5);

    return true;
  }

  end(): void {
    this.connected = false;
    this.emit('close');
  }

  destroy(): void {
    this.destroyed = true;
    this.connected = false;
    this.emit('close');
  }
}

/**
 * Global mock setup for external dependencies
 */
export function setupPlaybackMocks(): void {
  // Mock child_process.spawn
  jest.mock('child_process', () => ({
    spawn: jest.fn(() => new MockChildProcess()),
    ChildProcess: MockChildProcess
  }));

  // Mock fs for Unix socket operations
  jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn((path: string) => {
      // Mock socket file existence
      if (path.includes('.sock')) return true;
      return jest.requireActual('fs').existsSync(path);
    }),
    unlinkSync: jest.fn()
  }));

  // Mock net for Unix socket connections
  jest.mock('net', () => ({
    ...jest.requireActual('net'),
    createConnection: jest.fn(() => new MockUnixSocket())
  }));
}

/**
 * Utility functions for test assertions
 */
export const testUtils = {
  /**
   * Wait for a specified number of milliseconds
   */
  wait: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Wait for an event to be emitted
   */
  waitForEvent: <T>(emitter: EventEmitter, event: string, timeout = 1000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event '${event}' not emitted within ${timeout}ms`));
      }, timeout);

      emitter.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  },

  /**
   * Create a mock YouTube URL for testing
   */
  createMockYouTubeUrl: (videoId = 'dQw4w9WgXcQ'): string => {
    return `https://www.youtube.com/watch?v=${videoId}`;
  },

  /**
   * Create a mock stream URL for testing
   */
  createMockStreamUrl: (format = 'opus'): string => {
    return `https://example.com/stream.${format}`;
  }
};