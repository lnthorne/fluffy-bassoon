/**
 * API Infrastructure Exports
 * 
 * Central export point for all API infrastructure components including
 * types, middleware, routes, and utilities.
 * 
 * Requirements: 2.6, 2.7, 7.3, 10.1
 */

// Types and interfaces
export type {
  APIError,
  APIResponse,
  ValidationError,
  RateLimitError,
  APIRouteHandler,
  APIMiddleware,
} from './types';

export {
  REQUEST_LIMITS,
  HTTP_STATUS,
  API_ERROR_CODES,
} from './types';

// Middleware components
export {
  createRequestValidationMiddleware,
  createInputSanitizationMiddleware,
  createErrorHandlingMiddleware,
  createSecurityHeadersMiddleware,
  createRateLimitingMiddleware,
  registerAPIMiddleware,
} from './middleware';

// Route registration
export {
  registerAPIRoutes,
} from './routes';