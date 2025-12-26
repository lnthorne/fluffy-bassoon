/**
 * HTTP Server Infrastructure Tests
 * 
 * Tests for the Fastify-based HTTP server setup and configuration.
 * Requirements: 8.1, 8.6, 1.1, 1.2, 1.3, 1.5
 */

import { HTTPServer, HTTPServerConfig } from '../HTTPServer';

describe('HTTPServer', () => {
  let server: HTTPServer;
  const testConfig: HTTPServerConfig = {
    port: 0, // Use random port for testing
    host: '127.0.0.1',
    logger: false,
  };

  beforeEach(async () => {
    server = new HTTPServer(testConfig);
    await server.initialize();
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

  describe('initialization', () => {
    it('should create HTTPServer instance with config', () => {
      expect(server).toBeDefined();
      expect(server.getFastifyInstance).toBeDefined();
      expect(server.getServerInfo).toBeDefined();
    });

    it('should provide server info with correct structure', () => {
      const info = server.getServerInfo();
      expect(info).toMatchObject({
        port: testConfig.port,
        host: testConfig.host,
        addresses: expect.any(Array),
        uptime: expect.any(Number),
      });
    });
  });

  describe('placeholder pages', () => {
    it('should serve controller placeholder page at root route', async () => {
      const fastify = server.getFastifyInstance();
      
      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Party Jukebox');
      expect(response.body).toContain('Mobile Controller Interface');
      expect(response.body).toContain('Controller UI Coming Soon!');
      expect(response.body).toContain('jukebox.local');
    });

    it('should serve TV display placeholder page at /display route', async () => {
      const fastify = server.getFastifyInstance();
      
      const response = await fastify.inject({
        method: 'GET',
        url: '/display',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Party Jukebox');
      expect(response.body).toContain('TV Display Interface');
      expect(response.body).toContain('Now Playing');
      expect(response.body).toContain('Join the Party');
      expect(response.body).toContain('jukebox.local');
    });

    it('should serve 404 page for undefined routes', async () => {
      const fastify = server.getFastifyInstance();
      
      const response = await fastify.inject({
        method: 'GET',
        url: '/nonexistent-route',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('404');
      expect(response.body).toContain('Page Not Found');
      expect(response.body).toContain('Go to Controller Interface');
      expect(response.body).toContain('Go to TV Display');
    });

    it('should include navigation links in all placeholder pages', async () => {
      const fastify = server.getFastifyInstance();
      
      // Test controller page navigation
      const controllerResponse = await fastify.inject({
        method: 'GET',
        url: '/',
      });
      expect(controllerResponse.body).toContain('/display');
      expect(controllerResponse.body).toContain('/health');

      // Test display page navigation
      const displayResponse = await fastify.inject({
        method: 'GET',
        url: '/display',
      });
      expect(displayResponse.body).toContain('href="/"');
      expect(displayResponse.body).toContain('/health');

      // Test 404 page navigation
      const notFoundResponse = await fastify.inject({
        method: 'GET',
        url: '/invalid',
      });
      expect(notFoundResponse.body).toContain('href="/"');
      expect(notFoundResponse.body).toContain('/display');
      expect(notFoundResponse.body).toContain('/health');
    });

    it('should include server information in placeholder pages', async () => {
      const fastify = server.getFastifyInstance();
      
      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.body).toContain('Server Information');
      expect(response.body).toContain('Address:');
      expect(response.body).toContain('mDNS: jukebox.local');
      expect(response.body).toContain('Uptime:');
      expect(response.body).toContain('Status:');
    });

    it('should set appropriate Content-Type headers for HTML responses', async () => {
      const fastify = server.getFastifyInstance();
      
      const routes = ['/', '/display', '/nonexistent'];
      
      for (const route of routes) {
        const response = await fastify.inject({
          method: 'GET',
          url: route,
        });
        
        expect(response.headers['content-type']).toContain('text/html');
      }
    });

    it('should include responsive design meta tags', async () => {
      const fastify = server.getFastifyInstance();
      
      const routes = ['/', '/display'];
      
      for (const route of routes) {
        const response = await fastify.inject({
          method: 'GET',
          url: route,
        });
        
        expect(response.body).toContain('viewport');
        expect(response.body).toContain('width=device-width');
        expect(response.body).toContain('initial-scale=1.0');
      }
    });
  });

  describe('network IP validation', () => {
    it('should validate local network IPs correctly', () => {
      // Access the private method through the instance for testing
      const httpServer = server as any;
      
      // Test local IPs (should return true)
      expect(httpServer.isLocalNetworkIP('127.0.0.1')).toBe(true);
      expect(httpServer.isLocalNetworkIP('192.168.1.1')).toBe(true);
      expect(httpServer.isLocalNetworkIP('10.0.0.1')).toBe(true);
      expect(httpServer.isLocalNetworkIP('172.16.0.1')).toBe(true);
      
      // Test public IPs (should return false)
      expect(httpServer.isLocalNetworkIP('8.8.8.8')).toBe(false);
      expect(httpServer.isLocalNetworkIP('1.1.1.1')).toBe(false);
      
      // Test invalid/undefined IPs
      expect(httpServer.isLocalNetworkIP(undefined)).toBe(false);
      expect(httpServer.isLocalNetworkIP('')).toBe(false);
    });
  });

  describe('server configuration', () => {
    it('should bind to all interfaces when host is 0.0.0.0', () => {
      const config: HTTPServerConfig = {
        port: 3000,
        host: '0.0.0.0',
        logger: false,
      };
      
      const testServer = new HTTPServer(config);
      const info = testServer.getServerInfo();
      
      expect(info.host).toBe('0.0.0.0');
      expect(info.port).toBe(3000);
    });

    it('should get network addresses for server info', () => {
      const info = server.getServerInfo();
      expect(Array.isArray(info.addresses)).toBe(true);
      // Should have at least one address (even if empty in test environment)
      expect(info.addresses).toBeDefined();
    });
  });
});