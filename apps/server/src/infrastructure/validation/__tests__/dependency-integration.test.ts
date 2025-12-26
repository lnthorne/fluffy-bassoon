/**
 * Integration tests for dependency validation
 * Requirements: 7.5, 7.6
 */

import { DependencyValidator } from '../dependency-validator';

describe('DependencyValidator - Integration Tests', () => {
  describe('Real dependency checking', () => {
    it('should detect actual system state for dependencies', async () => {
      const result = await DependencyValidator.checkAllDependencies();
      
      // On most development systems, these dependencies won't be installed
      // This test validates that our detection works correctly
      console.log('Dependency check result:', {
        isValid: result.isValid,
        available: Object.keys(result.availableDependencies),
        missing: result.missingDependencies
      });
      
      // The test should complete without throwing errors
      expect(typeof result.isValid).toBe('boolean');
      
      // Should check for both dependencies
      const totalChecked = Object.keys(result.availableDependencies).length + result.missingDependencies.length;
      expect(totalChecked).toBe(2); // yt-dlp and mpv
      
      // If dependencies are missing, should provide helpful error messages
      if (result.missingDependencies.length > 0) {
        expect(result.errors.length).toBeGreaterThan(0);
        result.errors.forEach(error => {
          expect(error).toContain('not found');
        });
      }
    });

    it('should provide appropriate installation suggestions', async () => {
      const result = await DependencyValidator.checkAllDependencies();
      
      if (result.missingDependencies.length > 0) {
        const suggestions = DependencyValidator.getInstallationSuggestions(result.missingDependencies);
        
        result.missingDependencies.forEach(dep => {
          expect(suggestions[dep]).toBeDefined();
          expect(Array.isArray(suggestions[dep])).toBe(true);
          expect(suggestions[dep].length).toBeGreaterThan(0);
        });
      }
    });

    it('should handle validateDependencies method correctly', async () => {
      const result = await DependencyValidator.validateDependencies();
      
      // Should return a proper Result type
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.value).toBeDefined();
        expect(typeof result.value.ytDlp).toBe('string');
        expect(typeof result.value.mpv).toBe('string');
      } else {
        expect(result.error).toBe('DEPENDENCY_MISSING');
      }
    });
  });
});