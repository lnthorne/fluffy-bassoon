/**
 * APIService Tests
 * 
 * Basic tests to verify APIService functionality
 */

import { APIService } from '../APIService';

describe('APIService', () => {
  let apiService: APIService;

  beforeEach(() => {
    apiService = new APIService({
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      maxRetries: 2,
    });
  });

  describe('constructor', () => {
    it('should create APIService instance with correct config', () => {
      expect(apiService).toBeInstanceOf(APIService);
      
      const config = apiService.getConfig();
      expect(config.baseUrl).toBe('http://localhost:3000');
      expect(config.timeout).toBe(5000);
      expect(config.maxRetries).toBe(2);
    });

    it('should remove trailing slash from baseUrl', () => {
      const service = new APIService({
        baseUrl: 'http://localhost:3000/',
      });
      
      const config = service.getConfig();
      expect(config.baseUrl).toBe('http://localhost:3000');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration correctly', () => {
      apiService.updateConfig({
        timeout: 8000,
        maxRetries: 5,
      });

      const config = apiService.getConfig();
      expect(config.timeout).toBe(8000);
      expect(config.maxRetries).toBe(5);
      expect(config.baseUrl).toBe('http://localhost:3000'); // Should remain unchanged
    });

    it('should handle baseUrl updates correctly', () => {
      apiService.updateConfig({
        baseUrl: 'http://example.com/',
      });

      const config = apiService.getConfig();
      expect(config.baseUrl).toBe('http://example.com');
    });
  });
});