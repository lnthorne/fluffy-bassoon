/**
 * Simple tests for dependency validation utility
 * Requirements: 7.5, 7.6
 */

import { DependencyValidator } from '../dependency-validator';

describe('DependencyValidator - Simple Tests', () => {
  describe('getInstallationSuggestions', () => {
    it('should provide installation suggestions for yt-dlp', () => {
      const suggestions = DependencyValidator.getInstallationSuggestions(['yt-dlp']);
      
      expect(suggestions['yt-dlp']).toContain('pip install yt-dlp');
      expect(suggestions['yt-dlp']).toContain('pip3 install yt-dlp');
    });

    it('should provide installation suggestions for mpv', () => {
      const suggestions = DependencyValidator.getInstallationSuggestions(['mpv']);
      
      expect(suggestions['mpv']).toContain('apt-get install mpv  # Ubuntu/Debian');
      expect(suggestions['mpv']).toContain('brew install mpv     # macOS');
    });

    it('should handle multiple missing dependencies', () => {
      const suggestions = DependencyValidator.getInstallationSuggestions(['yt-dlp', 'mpv']);
      
      expect(suggestions['yt-dlp']).toBeDefined();
      expect(suggestions['mpv']).toBeDefined();
      expect(Object.keys(suggestions)).toHaveLength(2);
    });

    it('should handle unknown dependencies', () => {
      const suggestions = DependencyValidator.getInstallationSuggestions(['unknown-tool']);
      
      expect(suggestions['unknown-tool']).toContain('Please install unknown-tool manually');
    });
  });

  describe('checkDependency', () => {
    it('should handle dependency checking without crashing', async () => {
      // This test just ensures the method can be called without throwing
      const result = await DependencyValidator.checkDependency('yt-dlp');
      
      // Result should be either success or failure, but not throw
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(typeof result.value).toBe('string');
      } else {
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('checkAllDependencies', () => {
    it('should return a valid validation result structure', async () => {
      const result = await DependencyValidator.checkAllDependencies();
      
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.missingDependencies)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.availableDependencies).toBe('object');
    });

    it('should identify expected dependencies', async () => {
      const result = await DependencyValidator.checkAllDependencies();
      
      // Should check for both yt-dlp and mpv
      const allDeps = [...Object.keys(result.availableDependencies), ...result.missingDependencies];
      expect(allDeps.some(dep => dep === 'yt-dlp' || dep === 'ytDlp')).toBe(true);
      expect(allDeps.some(dep => dep === 'mpv')).toBe(true);
    });
  });
});