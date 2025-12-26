/**
 * Party Jukebox Server Entry Point
 * 
 * This is the main entry point for the Party Jukebox server application.
 * Currently implements the queue management system with rate limiting.
 */

import { RateLimiter } from './application/RateLimiter';

console.log('Party Jukebox Server - Queue Management System');
console.log('Rate limiter initialized');

// Export for testing
export { RateLimiter };