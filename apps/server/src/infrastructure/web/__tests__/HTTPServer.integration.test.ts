/**
 * HTTP Server Integration Tests
 * 
 * Integration tests for the complete HTTP server setup including Fastify initialization.
 * Requirements: 8.1, 8.6
 */

import { HTTPServer, HTTPServerConfig } from '../HTTPServer';

describe('HTTPServer Integration', () => {
  let server: HTTPServer;
  const testConfig: HTTPServerConfig = {
    port: 0, // Use random port for testing
    host: '127.0.0.1',
    logger: false,
  };

  beforeEach(() => {
    server = new HTTPServer(testConfig);
  });

  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('full server lifecycle', () => {
    it('should initialize, start, and stop server successfully', async () => {
      // Initialize with plugins
      await expect(server.initialize()).resolves.not.toThrow();
      
      // Start server
      await expect(server.start()).resolves.not.toThrow();
      
      // Verify server info is available
      const info = server.getServerInfo();
      expect(info.uptime).toBeGreaterThanOrEqual(0);
      
      // Stop server
      await expect(server.stop()).resolves.not.toThrow();
    }, 10000); // 10 second timeout for integration test

    it('should provide access to Fastify instance after initialization', async () => {
      await server.initialize();
      
      const fastify = server.getFastifyInstance();
      expect(fastify).toBeDefined();
      expect(typeof fastify.listen).toBe('function');
      expect(typeof fastify.register).toBe('function');
    });

    it('should have health endpoint available after initialization', async () => {
      await server.initialize();
      await server.start();
      
      const fastify = server.getFastifyInstance();
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'healthy',
        server: expect.any(Object),
        timestamp: expect.any(String),
      });
    });
  });

  describe('server configuration validation', () => {
    it('should configure server to bind to all interfaces (0.0.0.0)', () => {
      const productionConfig: HTTPServerConfig = {
        port: 3000,
        host: '0.0.0.0', // This is the requirement for local network access
        logger: false,
      };
      
      const prodServer = new HTTPServer(productionConfig);
      const info = prodServer.getServerInfo();
      
      expect(info.host).toBe('0.0.0.0');
      expect(info.port).toBe(3000);
    });

    it('should include security headers in responses', async () => {
      await server.initialize();
      await server.start();
      
      const fastify = server.getFastifyInstance();
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });
      
      // Verify security headers are set
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});