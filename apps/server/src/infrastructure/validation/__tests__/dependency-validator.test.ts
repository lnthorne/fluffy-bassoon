/**
 * Tests for dependency validation utility
 * Requirements: 7.5, 7.6
 */

import { DependencyValidator } from '../dependency-validator';

// Declare global test utilities type
declare global {
  var testUtils: {
    restoreDependencies(): void;
    mockDependencyMissing(dependency: string): void;
    mockAllDependenciesMissing(): void;
  };
}

describe('DependencyValidator', () => {
  beforeEach(() => {
    // Reset to default state where dependencies are available
    global.testUtils.restoreDependencies();
  });

  describe('validateDependencies', () => {
    it('should return success when all dependencies are available', async () => {
      const result = await DependencyValidator.validateDependencies();
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.ytDlp).toBe('/usr/local/bin/yt-dlp');
        expect(result.value.mpv).toBe('/usr/local/bin/mpv');
      }
    });

    it('should return error when yt-dlp is missing', async () => {
      global.testUtils.mockDependencyMissing('yt-dlp');
      
      const result = await DependencyValidator.validateDependencies();
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('DEPENDENCY_MISSING');
      }
    });

    it('should return error when mpv is missing', async () => {
      global.testUtils.mockDependencyMissing('mpv');
      
      const result = await DependencyValidator.validateDependencies();
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('DEPENDENCY_MISSING');
      }
    });

    it('should return error when all dependencies are missing', async () => {
      global.testUtils.mockAllDependenciesMissing();
      
      const result = await DependencyValidator.validateDependencies();
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('DEPENDENCY_MISSING');
      }
    });
  });

  describe('checkAllDependencies', () => {
    it('should provide detailed validation results', async () => {
      const result = await DependencyValidator.checkAllDependencies();
      
      expect(result.isValid).toBe(true);
      expect(result.availableDependencies.ytDlp).toBe('/usr/local/bin/yt-dlp');
      expect(result.availableDependencies.mpv).toBe('/usr/local/bin/mpv');
      expect(result.missingDependencies).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify missing dependencies', async () => {
      global.testUtils.mockDependencyMissing('yt-dlp');
      
      const result = await DependencyValidator.checkAllDependencies();
      
      expect(result.isValid).toBe(false);
      expect(result.availableDependencies.mpv).toBe('/usr/local/bin/mpv');
      expect(result.availableDependencies.ytDlp).toBeUndefined();
      expect(result.missingDependencies).toContain('yt-dlp');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('checkDependency', () => {
    it('should find available dependency', async () => {
      const result = await DependencyValidator.checkDependency('yt-dlp');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('/usr/local/bin/yt-dlp');
      }
    });

    it('should handle missing dependency', async () => {
      global.testUtils.mockDependencyMissing('yt-dlp');
      
      const result = await DependencyValidator.checkDependency('yt-dlp');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });
  });

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
    });
  });

  describe('validateAtStartup', () => {
    it('should complete successfully when dependencies are available', async () => {
      // Mock console methods to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await expect(DependencyValidator.validateAtStartup()).resolves.not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Validating external dependencies...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ All external dependencies are available');
      
      consoleSpy.mockRestore();
    });

    it('should throw error when dependencies are missing', async () => {
      global.testUtils.mockAllDependenciesMissing();
      
      // Mock console methods to avoid test output noise
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(DependencyValidator.validateAtStartup()).rejects.toThrow('Required dependencies are missing');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Dependency validation failed!');
      
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});