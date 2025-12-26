/**
 * ResolutionCache unit tests
 * Requirements: 6.1
 */

import { ResolutionCache } from '../ResolutionCache';
import { ResolvedStream } from '../../../domain/playback/types';

describe('ResolutionCache', () => {
  let cache: ResolutionCache;
  
  const mockResolvedStream: ResolvedStream = {
    streamUrl: 'https://example.com/stream.opus',
    title: 'Test Song',
    duration: 180,
    format: 'opus',
    quality: '128kbps'
  };

  beforeEach(() => {
    cache = new ResolutionCache();
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe('Basic cache operations', () => {
    it('should store and retrieve cached streams', () => {
      const url = 'https://youtube.com/watch?v=test123';
      
      // Initially empty
      expect(cache.get(url)).toBeNull();
      expect(cache.has(url)).toBe(false);
      expect(cache.size()).toBe(0);

      // Store stream
      cache.set(url, mockResolvedStream);
      
      // Should be retrievable
      expect(cache.get(url)).toEqual(mockResolvedStream);
      expect(cache.has(url)).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('should handle multiple entries', () => {
      const url1 = 'https://youtube.com/watch?v=test1';
      const url2 = 'https://youtube.com/watch?v=test2';
      
      const stream1 = { ...mockResolvedStream, title: 'Song 1' };
      const stream2 = { ...mockResolvedStream, title: 'Song 2' };

      cache.set(url1, stream1);
      cache.set(url2, stream2);

      expect(cache.size()).toBe(2);
      expect(cache.get(url1)).toEqual(stream1);
      expect(cache.get(url2)).toEqual(stream2);
    });

    it('should delete specific entries', () => {
      const url = 'https://youtube.com/watch?v=test123';
      
      cache.set(url, mockResolvedStream);
      expect(cache.has(url)).toBe(true);
      
      const deleted = cache.delete(url);
      expect(deleted).toBe(true);
      expect(cache.has(url)).toBe(false);
      expect(cache.size()).toBe(0);
    });

    it('should clear all entries', () => {
      cache.set('url1', mockResolvedStream);
      cache.set('url2', mockResolvedStream);
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.has('url1')).toBe(false);
      expect(cache.has('url2')).toBe(false);
    });
  });

  describe('Cache expiration', () => {
    it('should expire entries after TTL', async () => {
      // Create cache with very short expiration (100ms)
      const shortCache = new ResolutionCache(100);
      const url = 'https://youtube.com/watch?v=test123';
      
      shortCache.set(url, mockResolvedStream);
      expect(shortCache.has(url)).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortCache.has(url)).toBe(false);
      expect(shortCache.get(url)).toBeNull();
      
      shortCache.shutdown();
    });

    it('should not expire entries before TTL', async () => {
      // Create cache with longer expiration (1 second)
      const longCache = new ResolutionCache(1000);
      const url = 'https://youtube.com/watch?v=test123';
      
      longCache.set(url, mockResolvedStream);
      expect(longCache.has(url)).toBe(true);
      
      // Wait less than expiration time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(longCache.has(url)).toBe(true);
      expect(longCache.get(url)).toEqual(mockResolvedStream);
      
      longCache.shutdown();
    });

    it('should manually cleanup expired entries', async () => {
      const shortCache = new ResolutionCache(50);
      
      shortCache.set('url1', mockResolvedStream);
      shortCache.set('url2', mockResolvedStream);
      
      expect(shortCache.size()).toBe(2);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Manual cleanup
      const removedCount = shortCache.cleanup();
      
      expect(removedCount).toBe(2);
      expect(shortCache.size()).toBe(0);
      
      shortCache.shutdown();
    });
  });

  describe('Cache statistics', () => {
    it('should track hits and misses', () => {
      const url = 'https://youtube.com/watch?v=test123';
      
      // Initial stats
      let stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.size).toBe(0);

      // Miss
      cache.get(url);
      stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);

      // Store and hit
      cache.set(url, mockResolvedStream);
      cache.get(url);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.size).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const url = 'https://youtube.com/watch?v=test123';
      
      cache.set(url, mockResolvedStream);
      
      // 3 hits, 1 miss
      cache.get(url); // hit
      cache.get(url); // hit
      cache.get(url); // hit
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.75);
    });
  });

  describe('Utility methods', () => {
    it('should return cached URLs', () => {
      const url1 = 'https://youtube.com/watch?v=test1';
      const url2 = 'https://youtube.com/watch?v=test2';
      
      cache.set(url1, mockResolvedStream);
      cache.set(url2, mockResolvedStream);
      
      const urls = cache.getCachedUrls();
      expect(urls).toHaveLength(2);
      expect(urls).toContain(url1);
      expect(urls).toContain(url2);
    });

    it('should find expiring entries', async () => {
      const shortCache = new ResolutionCache(200); // 200ms expiration
      
      shortCache.set('url1', mockResolvedStream);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      shortCache.set('url2', mockResolvedStream);
      
      // Check for entries expiring within 200ms (should include url1 which has ~150ms left)
      const expiring = shortCache.getExpiringEntries(200);
      
      // Both entries should be expiring within 200ms
      expect(expiring.length).toBeGreaterThanOrEqual(1);
      expect(expiring.some(entry => entry.url === 'url1')).toBe(true);
      
      shortCache.shutdown();
    });
  });

  describe('Resource cleanup', () => {
    it('should shutdown cleanly', () => {
      cache.set('url1', mockResolvedStream);
      cache.set('url2', mockResolvedStream);
      
      expect(cache.size()).toBe(2);
      
      cache.shutdown();
      
      expect(cache.size()).toBe(0);
    });
  });
});