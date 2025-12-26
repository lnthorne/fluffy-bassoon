/**
 * Web Infrastructure Exports
 * 
 * Centralized exports for HTTP server, WebSocket server, API infrastructure, and web-related components.
 * 
 * Requirements: 8.1, 8.6, 5.1, 5.4, 5.5
 */

export { HTTPServer, HTTPServerConfig, HTTPServerDependencies, ServerInfo } from './HTTPServer';

// WebSocket infrastructure exports
export * from './websocket';

// API infrastructure exports
export * from './api';