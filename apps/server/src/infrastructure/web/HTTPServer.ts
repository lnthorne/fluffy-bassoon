/**
 * HTTP Server Infrastructure
 * 
 * Fastify-based HTTP server that provides REST API endpoints and serves
 * placeholder HTML pages for the Party Jukebox web interface.
 * 
 * Requirements: 8.1, 8.6
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { registerAPIRoutes } from './api';
import { IQueueService } from '../../application/QueueService';
import { IPlaybackOrchestrator } from '../../domain/playback/interfaces';

export interface ServerInfo {
  port: number;
  host: string;
  addresses: string[];
  uptime: number;
}

export interface HTTPServerConfig {
  port: number;
  host: string;
  logger?: boolean;
}

export interface HTTPServerDependencies {
  queueService: IQueueService;
  playbackOrchestrator: IPlaybackOrchestrator;
}

export class HTTPServer {
  private fastify: FastifyInstance;
  private config: HTTPServerConfig;
  private dependencies: HTTPServerDependencies | null = null;
  private startTime: Date | null = null;

  constructor(config: HTTPServerConfig) {
    this.config = config;
    this.fastify = Fastify({
      logger: config.logger ?? true,
      // Configure for local network access
      trustProxy: false,
    });
  }

  /**
   * Initialize the HTTP server with plugins and middleware
   * Requirements: 8.1, 8.6
   */
  async initialize(dependencies?: HTTPServerDependencies): Promise<void> {
    try {
      // Store dependencies for use in route handlers
      if (dependencies) {
        this.dependencies = dependencies;
      }

      // Register CORS plugin for local network access
      await this.fastify.register(cors, {
        origin: true, // Allow all origins for local network
        credentials: false,
      });

      // Register WebSocket plugin
      await this.fastify.register(websocket, {
        options: {
          maxPayload: 1048576, // 1MB max payload
          verifyClient: (info: { req: { socket: { remoteAddress?: string } } }) => {
            // Only allow local network connections
            const clientIP = info.req.socket.remoteAddress;
            return this.isLocalNetworkIP(clientIP);
          },
        },
      });

      // Register routes and middleware
      this.registerMiddleware();
      await this.registerRoutes();

      console.log('HTTP server initialized with Fastify, WebSocket, and CORS support');
    } catch (error) {
      console.error('Failed to initialize HTTP server:', error);
      throw error;
    }
  }

  /**
   * Start the HTTP server
   * Requirements: 8.1, 8.6
   */
  async start(): Promise<void> {
    try {
      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host, // Bind to all interfaces (0.0.0.0)
      });

      this.startTime = new Date();
      
      console.log(`✅ HTTP Server started on ${this.config.host}:${this.config.port}`);
      console.log(`   - Accessible via: http://jukebox.local:${this.config.port}`);
      console.log(`   - WebSocket endpoint: ws://jukebox.local:${this.config.port}/ws`);
      console.log(`   - CORS enabled for local network access`);
    } catch (error) {
      console.error('Failed to start HTTP server:', error);
      throw error;
    }
  }

  /**
   * Stop the HTTP server gracefully
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      console.log('HTTP server stopped gracefully');
    } catch (error) {
      console.error('Error stopping HTTP server:', error);
      throw error;
    }
  }

  /**
   * Get server information
   * Requirements: 8.1, 8.6
   */
  getServerInfo(): ServerInfo {
    const addresses = this.getNetworkAddresses();
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      port: this.config.port,
      host: this.config.host,
      addresses,
      uptime,
    };
  }

  /**
   * Get the Fastify instance for route registration
   */
  getFastifyInstance(): FastifyInstance {
    return this.fastify;
  }

  /**
   * Register middleware for security and request handling
   */
  private registerMiddleware(): void {
    // Security headers middleware
    this.fastify.addHook('onSend', async (request, reply, payload) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
      return payload;
    });

    // Request logging middleware
    this.fastify.addHook('onRequest', async (request, reply) => {
      const clientIP = request.ip;
      if (!this.isLocalNetworkIP(clientIP)) {
        reply.code(403).send({ error: 'Access denied: Local network only' });
        return;
      }
    });
  }

  /**
   * Register routes including placeholder pages and API endpoints
   * Requirements: 1.1, 1.2, 1.3, 1.5, 8.2, 8.3, 8.4, 8.7, 2.6, 2.7
   */
  private async registerRoutes(): Promise<void> {
    // Register API routes with /api prefix and pass dependencies
    await registerAPIRoutes(this.fastify, this.dependencies);
    
    // Health check endpoint
    this.fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      const serverInfo = this.getServerInfo();
      return {
        status: 'healthy',
        server: serverInfo,
        timestamp: new Date().toISOString(),
      };
    });

    // Controller placeholder page at root
    this.fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const serverInfo = this.getServerInfo();
      const html = this.generateControllerPlaceholderPage(serverInfo);
      reply.type('text/html').send(html);
    });

    // TV display placeholder page
    this.fastify.get('/display', async (request: FastifyRequest, reply: FastifyReply) => {
      const serverInfo = this.getServerInfo();
      const html = this.generateDisplayPlaceholderPage(serverInfo);
      reply.type('text/html').send(html);
    });

    // 404 error page for undefined routes
    this.fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const serverInfo = this.getServerInfo();
      const html = this.generate404Page(serverInfo);
      reply.code(404).type('text/html').send(html);
    });
  }

  /**
   * Generate controller placeholder page HTML
   * Requirements: 1.1, 8.2, 8.3, 8.4, 8.7
   */
  private generateControllerPlaceholderPage(serverInfo: ServerInfo): string {
    const addresses = serverInfo.addresses.length > 0 ? serverInfo.addresses[0] : 'localhost';
    const uptimeMinutes = Math.floor(serverInfo.uptime / 60000);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Party Jukebox - Controller</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        
        .logo {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .subtitle {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        
        .placeholder-message {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .placeholder-message h2 {
            margin-bottom: 1rem;
            font-size: 1.5rem;
        }
        
        .placeholder-message p {
            line-height: 1.6;
            margin-bottom: 1rem;
        }
        
        .navigation {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .nav-link {
            display: inline-block;
            padding: 12px 24px;
            background: rgba(255,255,255,0.2);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.3s ease;
            border: 1px solid rgba(255,255,255,0.3);
        }
        
        .nav-link:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        
        .server-info {
            background: rgba(0,0,0,0.2);
            border-radius: 8px;
            padding: 1rem;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        
        .server-info h3 {
            margin-bottom: 0.5rem;
            font-size: 1rem;
        }
        
        @media (max-width: 480px) {
            .logo {
                font-size: 2rem;
            }
            
            .subtitle {
                font-size: 1rem;
            }
            
            .placeholder-message {
                padding: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎵 Party Jukebox</div>
        <div class="subtitle">Mobile Controller Interface</div>
        
        <div class="placeholder-message">
            <h2>Controller UI Coming Soon!</h2>
            <p>This will be the mobile-first interface where party guests can:</p>
            <ul style="text-align: left; margin: 1rem 0;">
                <li>Search for songs on YouTube</li>
                <li>Add tracks to the party queue</li>
                <li>View what's currently playing</li>
                <li>See upcoming songs</li>
            </ul>
            <p>The React-based controller UI will be built and served from this location.</p>
        </div>
        
        <div class="navigation">
            <a href="/display" class="nav-link">📺 View TV Display</a>
            <a href="/health" class="nav-link">🔧 Server Health</a>
        </div>
        
        <div class="server-info">
            <h3>Server Information</h3>
            <div>Address: ${addresses}:${serverInfo.port}</div>
            <div>mDNS: jukebox.local:${serverInfo.port}</div>
            <div>Uptime: ${uptimeMinutes} minutes</div>
            <div>Status: Ready for development</div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate TV display placeholder page HTML
   * Requirements: 1.2, 8.2, 8.3, 8.4, 8.7
   */
  private generateDisplayPlaceholderPage(serverInfo: ServerInfo): string {
    const addresses = serverInfo.addresses.length > 0 ? serverInfo.addresses[0] : 'localhost';
    const uptimeMinutes = Math.floor(serverInfo.uptime / 60000);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Party Jukebox - TV Display</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(45deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .header {
            text-align: center;
            padding: 2rem;
            background: rgba(0,0,0,0.3);
        }
        
        .logo {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        
        .subtitle {
            font-size: 1.5rem;
            opacity: 0.9;
        }
        
        .main-content {
            flex: 1;
            display: flex;
            padding: 2rem;
            gap: 2rem;
        }
        
        .now-playing {
            flex: 2;
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }
        
        .now-playing h2 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }
        
        .placeholder-content {
            font-size: 1.2rem;
            line-height: 1.6;
            opacity: 0.8;
        }
        
        .queue-section {
            flex: 1;
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .queue-section h3 {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            text-align: center;
        }
        
        .join-instructions {
            background: rgba(0,0,0,0.3);
            padding: 1.5rem;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 1.5rem;
        }
        
        .join-url {
            font-size: 1.3rem;
            font-weight: bold;
            color: #64ffda;
            margin: 0.5rem 0;
        }
        
        .qr-placeholder {
            width: 120px;
            height: 120px;
            background: rgba(255,255,255,0.9);
            border-radius: 8px;
            margin: 1rem auto;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
            font-weight: bold;
        }
        
        .footer {
            background: rgba(0,0,0,0.3);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
        }
        
        .navigation-links {
            display: flex;
            gap: 1rem;
        }
        
        .nav-link {
            color: #64ffda;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            transition: background 0.3s ease;
        }
        
        .nav-link:hover {
            background: rgba(255,255,255,0.1);
        }
        
        @media (max-width: 1024px) {
            .main-content {
                flex-direction: column;
            }
            
            .logo {
                font-size: 2.5rem;
            }
            
            .now-playing h2 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🎵 Party Jukebox</div>
        <div class="subtitle">TV Display Interface</div>
    </div>
    
    <div class="main-content">
        <div class="now-playing">
            <h2>🎶 Now Playing</h2>
            <div class="placeholder-content">
                <p>The full-screen TV display interface will show:</p>
                <br>
                <p>• Large now playing section with track info</p>
                <p>• Album artwork and progress</p>
                <p>• Queue preview with upcoming tracks</p>
                <p>• Real-time updates via WebSocket</p>
                <br>
                <p>This React-based kiosk UI will be optimized for TV viewing from across the room.</p>
            </div>
        </div>
        
        <div class="queue-section">
            <h3>📱 Join the Party</h3>
            
            <div class="join-instructions">
                <p>Open your phone's browser and go to:</p>
                <div class="join-url">jukebox.local:${serverInfo.port}</div>
                <p>or</p>
                <div class="join-url">${addresses}:${serverInfo.port}</div>
                
                <div class="qr-placeholder">
                    QR Code
                    <br>
                    (Coming Soon)
                </div>
            </div>
            
            <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                <h4 style="margin-bottom: 0.5rem;">🎵 Up Next</h4>
                <p style="opacity: 0.8; font-size: 0.9rem;">Queue will appear here when tracks are added</p>
            </div>
        </div>
    </div>
    
    <div class="footer">
        <div>
            Server: ${addresses}:${serverInfo.port} | Uptime: ${uptimeMinutes}m | Status: Ready
        </div>
        <div class="navigation-links">
            <a href="/" class="nav-link">📱 Controller</a>
            <a href="/health" class="nav-link">🔧 Health</a>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate 404 error page HTML
   * Requirements: 1.5, 8.4
   */
  private generate404Page(serverInfo: ServerInfo): string {
    const addresses = serverInfo.addresses.length > 0 ? serverInfo.addresses[0] : 'localhost';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - Party Jukebox</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            text-align: center;
        }
        
        .container {
            max-width: 500px;
            width: 100%;
        }
        
        .error-code {
            font-size: 6rem;
            font-weight: bold;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .error-message {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        
        .description {
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .description p {
            line-height: 1.6;
            margin-bottom: 1rem;
        }
        
        .navigation {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .nav-link {
            display: inline-block;
            padding: 12px 24px;
            background: rgba(255,255,255,0.2);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.3s ease;
            border: 1px solid rgba(255,255,255,0.3);
        }
        
        .nav-link:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        
        .server-info {
            background: rgba(0,0,0,0.2);
            border-radius: 8px;
            padding: 1rem;
            font-size: 0.9rem;
            opacity: 0.8;
        }
        
        @media (max-width: 480px) {
            .error-code {
                font-size: 4rem;
            }
            
            .error-message {
                font-size: 1.2rem;
            }
            
            .description {
                padding: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-code">404</div>
        <div class="error-message">Page Not Found</div>
        
        <div class="description">
            <p>Oops! The page you're looking for doesn't exist.</p>
            <p>The Party Jukebox server is running, but this URL isn't available.</p>
        </div>
        
        <div class="navigation">
            <a href="/" class="nav-link">📱 Go to Controller Interface</a>
            <a href="/display" class="nav-link">📺 Go to TV Display</a>
            <a href="/health" class="nav-link">🔧 Check Server Health</a>
        </div>
        
        <div class="server-info">
            Server: ${addresses}:${serverInfo.port} | Available Routes: /, /display, /health
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Check if an IP address is from the local network
   * Requirements: 10.7
   */
  private isLocalNetworkIP(ip: string | undefined): boolean {
    if (!ip) return false;

    // Remove IPv6 prefix if present
    const cleanIP = ip.replace(/^::ffff:/, '');

    // Local network ranges (RFC 1918)
    const localRanges = [
      /^127\./, // Loopback
      /^10\./, // Class A private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
      /^192\.168\./, // Class C private
      /^::1$/, // IPv6 loopback
      /^fe80:/, // IPv6 link-local
    ];

    return localRanges.some(range => range.test(cleanIP));
  }

  /**
   * Get available network addresses for server info
   */
  private getNetworkAddresses(): string[] {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.family === 'IPv4') {
          addresses.push(iface.address);
        }
      }
    }

    return addresses;
  }
}