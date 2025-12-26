/**
 * ResolutionCache implementation with TTL and cleanup logic
 * Requirements: 6.1
 */

import { ResolvedStream, ResolutionCache as CacheEntry } from '../../domain/playback/types';

/**
 * Cache statistics for monitoring and debugging
 * Requirements: 6.1
 */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly hitRate: number;
}

/**
 * ResolutionCache manages in-memory caching of resolved YouTube streams
 * with automatic expiration and cleanup logic
 * Requirements: 6.1
 */
export class ResolutionCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly expirationMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Statistics tracking
  private hits = 0;
  private misses = 0;

  /**
   * Create a new ResolutionCache
   * @param expirationMs Cache entry expiration time in milliseconds (default: 5 minutes)
   * @param cleanupIntervalMs Cleanup interval in milliseconds (default: 1 minute)
   */
  constructor(
    expirationMs: number = 5 * 60 * 1000, // 5 minutes
    cleanupIntervalMs: number = 60 * 1000   // 1 minute
  ) {
    this.expirationMs = expirationMs;
    this.startCleanupTimer(cleanupIntervalMs);
  }

  /**
   * Get a cached resolution if available and not expired
   * Requirements: 6.1
   */
  get(url: string): ResolvedStream | null {
    const entry = this.cache.get(url);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(url);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.resolvedStream;
  }

  /**
   * Store a resolved stream in the cache
   * Requirements: 6.1
   */
  set(url: string, resolvedStream: ResolvedStream): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expirationMs);

    const entry: CacheEntry = {
      url,
      resolvedStream,
      timestamp: now,
      expiresAt
    };

    this.cache.set(url, entry);
  }

  /**
   * Check if a URL is cached and not expired
   * Requirements: 6.1
   */
  has(url: string): boolean {
    const entry = this.cache.get(url);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(url);
      return false;
    }

    return true;
  }

  /**
   * Remove a specific entry from the cache
   * Requirements: 6.1
   */
  delete(url: string): boolean {
    return this.cache.delete(url);
  }

  /**
   * Clear all entries from the cache
   * Requirements: 6.1
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get current cache size
   * Requirements: 6.1
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics for monitoring
   * Requirements: 6.1
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate
    };
  }

  /**
   * Manually trigger cleanup of expired entries
   * Requirements: 6.1
   */
  cleanup(): number {
    let removedCount = 0;
    const now = new Date();

    for (const [url, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(url);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get all cached URLs (for debugging/monitoring)
   * Requirements: 6.1
   */
  getCachedUrls(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries that will expire within the specified time
   * Requirements: 6.1
   */
  getExpiringEntries(withinMs: number): CacheEntry[] {
    const threshold = new Date(Date.now() + withinMs);
    const expiring: CacheEntry[] = [];

    for (const entry of this.cache.values()) {
      if (entry.expiresAt <= threshold) {
        expiring.push(entry);
      }
    }

    return expiring;
  }

  /**
   * Shutdown the cache and cleanup resources
   * Requirements: 6.1
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Check if a cache entry has expired
   * Requirements: 6.1
   */
  private isExpired(entry: CacheEntry): boolean {
    return new Date() > entry.expiresAt;
  }

  /**
   * Start the automatic cleanup timer
   * Requirements: 6.1
   */
  private startCleanupTimer(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);

    // Don't keep the process alive just for cleanup
    this.cleanupInterval.unref();
  }
}