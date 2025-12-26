/**
 * Dependency validation utility for external executables
 * Requirements: 7.5, 7.6
 */

import which from 'which';
import { Result } from '@party-jukebox/shared';
import { ProcessError, PlaybackErrorFactory } from '../../domain/playback';

/**
 * Required external dependencies for the playback system
 */
export interface ExternalDependencies {
  ytDlp: string;
  mpv: string;
}

/**
 * Dependency validation result
 */
export interface DependencyValidationResult {
  isValid: boolean;
  availableDependencies: Partial<ExternalDependencies>;
  missingDependencies: string[];
  errors: string[];
}

/**
 * Dependency validator for external executables
 * Requirements: 7.5, 7.6
 */
export class DependencyValidator {
  private static readonly REQUIRED_DEPENDENCIES = {
    'yt-dlp': 'YouTube stream resolution',
    'mpv': 'Audio playback'
  };

  /**
   * Validate all required external dependencies
   * Requirements: 7.5, 7.6
   */
  static async validateDependencies(): Promise<Result<ExternalDependencies, ProcessError>> {
    const result = await this.checkAllDependencies();
    
    if (!result.isValid) {
      const errorMessage = `Missing required dependencies: ${result.missingDependencies.join(', ')}`;
      console.error('Dependency validation failed:', errorMessage);
      console.error('Available dependencies:', result.availableDependencies);
      console.error('Installation suggestions:');
      
      result.missingDependencies.forEach(dep => {
        const purpose = this.REQUIRED_DEPENDENCIES[dep as keyof typeof this.REQUIRED_DEPENDENCIES];
        console.error(`  - ${dep}: Required for ${purpose}`);
        
        if (dep === 'yt-dlp') {
          console.error('    Install: pip install yt-dlp');
        } else if (dep === 'mpv') {
          console.error('    Install: apt-get install mpv (Ubuntu/Debian) or brew install mpv (macOS)');
        }
      });
      
      return {
        success: false,
        error: 'DEPENDENCY_MISSING'
      };
    }

    return {
      success: true,
      value: result.availableDependencies as ExternalDependencies
    };
  }

  /**
   * Check all dependencies and return detailed results
   * Requirements: 7.5, 7.6
   */
  static async checkAllDependencies(): Promise<DependencyValidationResult> {
    const results = await Promise.allSettled([
      this.checkDependency('yt-dlp'),
      this.checkDependency('mpv')
    ]);

    const availableDependencies: Partial<ExternalDependencies> = {};
    const missingDependencies: string[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      const depName = index === 0 ? 'yt-dlp' : 'mpv';
      const depKey = index === 0 ? 'ytDlp' : 'mpv';
      
      if (result.status === 'fulfilled' && result.value.success) {
        availableDependencies[depKey as keyof ExternalDependencies] = result.value.value;
      } else {
        missingDependencies.push(depName);
        if (result.status === 'rejected') {
          errors.push(`${depName}: ${result.reason}`);
        } else if (!result.value.success) {
          errors.push(`${depName}: ${result.value.error}`);
        }
      }
    });

    return {
      isValid: missingDependencies.length === 0,
      availableDependencies,
      missingDependencies,
      errors
    };
  }

  /**
   * Check if a specific dependency is available
   * Requirements: 7.5, 7.6
   */
  static async checkDependency(command: string): Promise<Result<string, string>> {
    try {
      const path = await which(command);
      return {
        success: true,
        value: path
      };
    } catch (error) {
      return {
        success: false,
        error: `Command '${command}' not found in PATH`
      };
    }
  }

  /**
   * Get installation suggestions for missing dependencies
   * Requirements: 7.6
   */
  static getInstallationSuggestions(missingDependencies: string[]): Record<string, string[]> {
    const suggestions: Record<string, string[]> = {};

    missingDependencies.forEach(dep => {
      switch (dep) {
        case 'yt-dlp':
          suggestions[dep] = [
            'pip install yt-dlp',
            'pip3 install yt-dlp',
            'python -m pip install yt-dlp'
          ];
          break;
        case 'mpv':
          suggestions[dep] = [
            'apt-get install mpv  # Ubuntu/Debian',
            'yum install mpv      # CentOS/RHEL',
            'brew install mpv     # macOS',
            'pacman -S mpv        # Arch Linux'
          ];
          break;
        default:
          suggestions[dep] = [`Please install ${dep} manually`];
      }
    });

    return suggestions;
  }

  /**
   * Validate dependencies at startup and provide clear error messages
   * Requirements: 7.5, 7.6
   */
  static async validateAtStartup(): Promise<void> {
    console.log('Validating external dependencies...');
    
    const result = await this.validateDependencies();
    
    if (!result.success) {
      const validationResult = await this.checkAllDependencies();
      const suggestions = this.getInstallationSuggestions(validationResult.missingDependencies);
      
      console.error('\n❌ Dependency validation failed!');
      console.error('\nMissing dependencies:');
      validationResult.missingDependencies.forEach(dep => {
        const purpose = this.REQUIRED_DEPENDENCIES[dep as keyof typeof this.REQUIRED_DEPENDENCIES];
        console.error(`  • ${dep} - Required for ${purpose}`);
      });
      
      console.error('\nInstallation suggestions:');
      Object.entries(suggestions).forEach(([dep, commands]) => {
        console.error(`\n${dep}:`);
        commands.forEach(cmd => console.error(`  ${cmd}`));
      });
      
      console.error('\nPlease install the missing dependencies and restart the application.');
      
      // In a real application, you might want to exit here
      // process.exit(1);
      
      throw new Error('Required dependencies are missing');
    }
    
    console.log('✅ All external dependencies are available');
  }
}