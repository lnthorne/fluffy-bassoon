/**
 * Party Jukebox Server Entry Point
 * 
 * This is the main entry point for the Party Jukebox server application.
 * Validates external dependencies and initializes the complete system including
 * queue management and playback orchestration.
 */

import { QueueManager } from './application/QueueManager';
import { RateLimiter } from './application/RateLimiter';
import { QueueService } from './application/QueueService';
import { PlaybackOrchestrator } from './application/PlaybackOrchestrator';
import { 
  StreamResolver, 
  PlaybackController, 
  ProcessManager,
  IPCClient
} from './infrastructure/playback';
import { DependencyValidator } from './infrastructure/validation/dependency-validator';
import { HTTPServer, HTTPServerConfig, HTTPServerDependencies } from './infrastructure/web';

// Global service instances
let queueService: QueueService | null = null;
let playbackOrchestrator: PlaybackOrchestrator | null = null;
let processManager: ProcessManager | null = null;
let httpServer: HTTPServer | null = null;

/**
 * Initialize the Party Jukebox server with dependency validation
 * Requirements: 7.5, 7.6, 3.5, 4.3
 */
async function initializeServer(): Promise<void> {
  console.log('Party Jukebox Server - Starting up...');
  
  try {
    // Validate external dependencies at startup
    await DependencyValidator.validateAtStartup();
    
    // Initialize infrastructure components
    console.log('Initializing infrastructure components...');
    
    // Create process manager for external process lifecycle
    processManager = new ProcessManager();
    
    // Validate playback dependencies
    const depValidation = await processManager.validateDependencies();
    if (!depValidation.success) {
      throw new Error(`Playback dependencies validation failed: ${depValidation.error}`);
    }
    
    // Create stream resolver with process manager
    const streamResolver = new StreamResolver(processManager);
    
    // Create IPC client for MPV communication
    const ipcClient = new IPCClient();
    
    // Create playback controller with IPC client and process manager
    const playbackController = new PlaybackController(ipcClient, processManager);
    
    // Initialize application components
    console.log('Initializing application services...');
    
    // Create queue management components
    const queueManager = new QueueManager();
    const rateLimiter = new RateLimiter();
    
    // Create queue service
    queueService = new QueueService(queueManager, rateLimiter);
    
    // Create playback orchestrator with all dependencies
    playbackOrchestrator = new PlaybackOrchestrator(
      queueService,
      streamResolver,
      playbackController
    );
    
    // Start the playback orchestrator
    console.log('Starting playback orchestration...');
    const startResult = await playbackOrchestrator.start();
    if (!startResult.success) {
      throw new Error(`Failed to start playback orchestrator: ${startResult.error}`);
    }
    
    // Initialize and start HTTP server
    console.log('Initializing HTTP server...');
    const httpConfig: HTTPServerConfig = {
      port: 3000,
      host: '0.0.0.0', // Bind to all interfaces for local network access
      logger: process.env.NODE_ENV !== 'test',
    };
    
    const httpDependencies: HTTPServerDependencies = {
      queueService,
    };
    
    httpServer = new HTTPServer(httpConfig);
    await httpServer.initialize(httpDependencies);
    await httpServer.start();
    
    // Set up graceful shutdown
    setupGracefulShutdown();
    
    console.log('✅ Party Jukebox Server ready');
    console.log('   - Queue management: Active');
    console.log('   - Playback orchestration: Active');
    console.log('   - HTTP server: Active on port 3000');
    console.log('   - WebSocket server: Active at /ws');
    console.log('   - External dependencies: Validated');
    
  } catch (error) {
    console.error('❌ Server startup failed:', error instanceof Error ? error.message : error);
    
    // Cleanup on startup failure
    await cleanup();
    
    // In production, exit the process on startup failure
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    
    // In development/test, re-throw for proper error handling
    throw error;
  }
}

/**
 * Set up graceful shutdown handlers
 * Requirements: 6.5, 7.4
 */
function setupGracefulShutdown(): void {
  const shutdownHandler = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await cleanup();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await cleanup();
    process.exit(1);
  });
  
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    await cleanup();
    process.exit(1);
  });
}

/**
 * Cleanup all services and resources
 * Requirements: 6.5, 7.4
 */
async function cleanup(): Promise<void> {
  console.log('Cleaning up services...');
  
  try {
    // Stop HTTP server first
    if (httpServer) {
      console.log('Stopping HTTP server...');
      await httpServer.stop();
      httpServer = null;
    }
    
    // Stop playback orchestrator
    if (playbackOrchestrator) {
      console.log('Stopping playback orchestrator...');
      await playbackOrchestrator.stop();
      await playbackOrchestrator.cleanup();
      playbackOrchestrator = null;
    }
    
    // Cleanup process manager (this will stop all external processes)
    if (processManager) {
      console.log('Cleaning up external processes...');
      await processManager.cleanup();
      processManager = null;
    }
    
    // Reset queue service
    queueService = null;
    
    console.log('Cleanup completed');
    
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

/**
 * Get the HTTP server instance (for testing or external access)
 */
function getHTTPServer(): HTTPServer | null {
  return httpServer;
}

/**
 * Get the queue service instance (for testing or external access)
 */
function getQueueService(): QueueService | null {
  return queueService;
}

/**
 * Get the playback orchestrator instance (for testing or external access)
 */
function getPlaybackOrchestrator(): PlaybackOrchestrator | null {
  return playbackOrchestrator;
}

// Start the server if this file is run directly
if (require.main === module) {
  initializeServer().catch(error => {
    console.error('Fatal startup error:', error);
    process.exit(1);
  });
}

// Export for testing and external access
export { 
  initializeServer, 
  cleanup,
  getHTTPServer,
  getQueueService,
  getPlaybackOrchestrator,
  // Legacy exports for compatibility
  RateLimiter 
};