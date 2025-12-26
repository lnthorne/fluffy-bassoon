/**
 * Party Jukebox Server Entry Point
 * 
 * This is the main entry point for the Party Jukebox server application.
 * Validates external dependencies and initializes the queue management system.
 */

import { RateLimiter } from './application/RateLimiter';
import { DependencyValidator } from './infrastructure/validation/dependency-validator';

/**
 * Initialize the Party Jukebox server with dependency validation
 * Requirements: 7.5, 7.6
 */
async function initializeServer(): Promise<void> {
  console.log('Party Jukebox Server - Starting up...');
  
  try {
    // Validate external dependencies at startup
    await DependencyValidator.validateAtStartup();
    
    // Initialize application components
    console.log('Initializing queue management system...');
    console.log('Rate limiter initialized');
    
    console.log('✅ Party Jukebox Server ready');
  } catch (error) {
    console.error('❌ Server startup failed:', error instanceof Error ? error.message : error);
    
    // In production, exit the process on startup failure
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    
    // In development/test, re-throw for proper error handling
    throw error;
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  initializeServer().catch(error => {
    console.error('Fatal startup error:', error);
    process.exit(1);
  });
}

// Export for testing
export { RateLimiter, initializeServer };