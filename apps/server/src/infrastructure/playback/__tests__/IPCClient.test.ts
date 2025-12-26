/**
 * Unit tests for IPCClient
 * Requirements: 2.2, 2.6
 */

import { IPCClient } from '../IPCClient';
import { MPVCommand, MPVResponse } from '../../../domain/playback/types';

// Simple integration test approach - test the core functionality
describe('IPCClient', () => {
  let ipcClient: IPCClient;

  beforeEach(() => {
    ipcClient = new IPCClient();
  });

  afterEach(async () => {
    if (ipcClient.isConnected()) {
      await ipcClient.disconnect();
    }
  });

  describe('connection state', () => {
    it('should start disconnected', () => {
      expect(ipcClient.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(ipcClient.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('command handling', () => {
    it('should reject commands when not connected', async () => {
      const command: MPVCommand = {
        command: ['pause']
      };

      await expect(ipcClient.sendCommand(command)).rejects.toThrow('Not connected to MPV');
    });
  });

  describe('event listeners', () => {
    it('should allow adding and removing event listeners', () => {
      const listener = jest.fn();
      
      // Should not throw
      ipcClient.addEventListener(listener);
      ipcClient.removeEventListener(listener);
    });
  });
});