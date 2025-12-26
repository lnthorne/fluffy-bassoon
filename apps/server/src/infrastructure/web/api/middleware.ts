/**
 * API Middleware Components
 * 
 * Middleware functions for request validation, error handling, security headers,
 * and CORS configuration for the REST API infrastructure.
 * 
 * Requirements: 2.6, 2.7, 7.3, 10.1, 10.2, 10.5, 10.6
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { 
  APIError, 
  APIResponse, 
  ValidationError, 
  HTTP_STATUS, 
  API_ERROR_CODES,
  REQUEST_LIMITS 
} from './types';

/**
 * Request validation middleware
 * Validates request size, content type, and basic structure
 * Requirements: 10.1, 10.4
 */
export function createRequestValidationMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check request size limits
      const contentLength = request.headers['content-length'];
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        const limit = getRequestSizeLimit(request.url);
        
        if (size > limit) {
          const error: APIError = {
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: `Request too large. Maximum size: ${limit} bytes`,
            details: { size, limit },
            timestamp: new Date().toISOString(),
          };
          
          reply.code(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // Validate JSON content type for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers['content-type'];
        if (contentType && !contentType.includes('application/json')) {
          const error: APIError = {
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'Content-Type must be application/json',
            details: { received: contentType },
            timestamp: new Date().toISOString(),
          };
          
          reply.code(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
    } catch (error) {
      // Log validation errors but don't expose internal details
      console.error('Request validation error:', error);
      
      const apiError: APIError = {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Request validation failed',
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
        success: false,
        error: apiError,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Input sanitization middleware
 * Sanitizes user inputs to prevent injection attacks
 * Requirements: 10.6
 */
export function createInputSanitizationMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Sanitize query parameters
      if (request.query && typeof request.query === 'object') {
        request.query = sanitizeObject(request.query);
      }

      // Sanitize request body
      if (request.body && typeof request.body === 'object') {
        request.body = sanitizeObject(request.body);
      }
    } catch (error) {
      console.error('Input sanitization error:', error);
      
      const apiError: APIError = {
        code: API_ERROR_CODES.MALFORMED_DATA,
        message: 'Invalid input data format',
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: apiError,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Error handling middleware
 * Provides consistent error responses and logging
 * Requirements: 7.3, 7.4
 */
export function createErrorHandlingMiddleware() {
  return (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    // Log the error with context
    console.error('API Error:', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      ip: request.ip,
      timestamp: new Date().toISOString(),
    });

    // Handle JSON parsing errors
    if (error.message.includes('JSON')) {
      const apiError: APIError = {
        code: API_ERROR_CODES.INVALID_JSON,
        message: 'Invalid JSON in request body',
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: apiError,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const apiError: APIError = {
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Request validation failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: apiError,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Default internal server error
    const apiError: APIError = {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: apiError,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Security headers middleware
 * Adds security headers to all API responses
 * Requirements: 10.2
 */
export function createSecurityHeadersMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Set security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Prevent caching of API responses
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
  };
}

/**
 * Rate limiting middleware (IP-based)
 * Simple in-memory rate limiting for API endpoints
 * Requirements: 10.5
 */
export function createRateLimitingMiddleware() {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_SIZE = 60 * 1000; // 1 minute
  const MAX_REQUESTS = 60; // 60 requests per minute per IP

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const clientIP = request.ip;
    const now = Date.now();
    
    // Clean up expired entries
    for (const [ip, data] of requestCounts.entries()) {
      if (now > data.resetTime) {
        requestCounts.delete(ip);
      }
    }
    
    // Get or create request count for this IP
    let requestData = requestCounts.get(clientIP);
    if (!requestData || now > requestData.resetTime) {
      requestData = { count: 0, resetTime: now + WINDOW_SIZE };
      requestCounts.set(clientIP, requestData);
    }
    
    // Check rate limit
    if (requestData.count >= MAX_REQUESTS) {
      const retryAfter = Math.ceil((requestData.resetTime - now) / 1000);
      
      const error: APIError = {
        code: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please try again later.',
        details: { retryAfter },
        timestamp: new Date().toISOString(),
      };
      
      reply
        .code(HTTP_STATUS.TOO_MANY_REQUESTS)
        .header('Retry-After', retryAfter.toString())
        .send({
          success: false,
          error,
          timestamp: new Date().toISOString(),
        });
      return;
    }
    
    // Increment request count
    requestData.count++;
  };
}

/**
 * Get request size limit based on endpoint
 */
function getRequestSizeLimit(url: string): number {
  if (url.includes('/search')) {
    return REQUEST_LIMITS.SEARCH;
  }
  if (url.includes('/queue/add')) {
    return REQUEST_LIMITS.QUEUE_ADD;
  }
  return REQUEST_LIMITS.DEFAULT;
}

/**
 * Sanitize an object by removing potentially dangerous content
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeValue(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  
  return sanitized;
}

/**
 * Sanitize a single value
 */
function sanitizeValue(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remove potentially dangerous characters and patterns
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>'"]/g, '') // Remove HTML special characters
    .trim();
}

/**
 * Register all API middleware with a Fastify instance
 */
export function registerAPIMiddleware(fastify: FastifyInstance): void {
  // Register middleware in order of execution
  fastify.addHook('preHandler', createSecurityHeadersMiddleware());
  fastify.addHook('preHandler', createRateLimitingMiddleware());
  fastify.addHook('preHandler', createRequestValidationMiddleware());
  fastify.addHook('preHandler', createInputSanitizationMiddleware());
  
  // Register error handler
  fastify.setErrorHandler(createErrorHandlingMiddleware());
}