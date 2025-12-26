/**
 * ProcessManager for external process lifecycle management
 * Handles mpv and yt-dlp process spawning, monitoring, and cleanup
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.7
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { Result } from '@party-jukebox/shared';
import { IProcessManager } from '../../domain/playback/interfaces';
import { 
  MpvOptions, 
  YtDlpOptions, 
  ResolvedStream 
} from '../../domain/playback/types';
import { ProcessError } from '../../domain/playback/errors';

/**
 * Process resource limits and configuration
 * Requirements: 6.2, 7.7
 */
interface ProcessLimits {
  readonly maxMemoryMB: number;
  readonly maxCpuPercent: number;
  readonly timeoutMs: number;
  readonly maxConcurrent: number;
}

/**
 * Process health monitoring data
 * Requirements: 2.7, 5.3, 7.2, 7.3
 */
interface ProcessHealth {
  readonly pid: number;
  readonly startTime: Date;
  readonly lastHealthCheck: Date;
  readonly isResponsive: boolean;
  readonly memoryUsageMB: number;
}

export class ProcessManager implements IProcessManager {
  private mpvProcess: ChildProcess | null = null;
  private mpvOptions: MpvOptions | null = null;
  private runningYtDlpProcesses = new Set<ChildProcess>();
  private processHealth = new Map<number, ProcessHealth>();
  private cleanupHandlers = new Set<() => Promise<void>>();

  // Process limits configuration
  // Requirements: 6.2, 6.6, 7.7
  private readonly limits: ProcessLimits = {
    maxMemoryMB: 50, // Conservative limit for Raspberry Pi
    maxCpuPercent: 80,
    timeoutMs: 30000, // 30 seconds for yt-dlp
    maxConcurrent: 2 // Limit concurrent yt-dlp processes
  };

  constructor() {
    // Set up process cleanup on exit
    // Requirements: 6.5, 7.4
    process.on('exit', () => this.syncCleanup());
    process.on('SIGINT', () => this.cleanup().then(() => process.exit(0)));
    process.on('SIGTERM', () => this.cleanup().then(() => process.exit(0)));
    process.on('uncaughtException', () => this.cleanup().then(() => process.exit(1)));
  }

  /**
   * Start MPV process with specified options
   * Requirements: 2.1, 2.7, 7.1, 7.2
   */
  async startMpv(options: MpvOptions): Promise<Result<ChildProcess, ProcessError>> {
    try {
      // Stop existing mpv process if running
      // Requirements: 2.8 - ensure only one mpv instance
      if (this.mpvProcess) {
        await this.stopMpv();
      }

      // Validate mpv executable exists
      // Requirements: 7.5, 7.6
      const mpvValidation = await this.validateExecutable('mpv');
      if (!mpvValidation.success) {
        return { success: false, error: 'DEPENDENCY_MISSING' };
      }

      // Prepare mpv arguments
      const args = [
        '--no-video', // Audio only
        '--quiet', // Minimal output
        '--no-terminal', // No interactive terminal
        '--idle=yes', // Keep process alive
        `--input-ipc-server=${options.inputIpcServer}`, // IPC socket
        `--volume=${options.volume}`,
        '--audio-display=no', // No audio visualization
        '--gapless-audio=yes' // Smooth track transitions
      ];

      // Spawn options with resource limits
      // Requirements: 7.1, 7.7
      const spawnOptions: SpawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: {
          ...process.env,
          // Limit memory usage
          NODE_OPTIONS: `--max-old-space-size=${this.limits.maxMemoryMB}`
        }
      };

      // Spawn mpv process
      const mpvProcess = spawn('mpv', args, spawnOptions);

      // Handle process startup
      return new Promise((resolve) => {
        let resolved = false;

        // Handle successful startup
        const onReady = () => {
          if (resolved) return;
          resolved = true;

          this.mpvProcess = mpvProcess;
          this.mpvOptions = options;
          
          // Start health monitoring
          // Requirements: 2.7, 5.3, 7.2, 7.3
          this.startHealthMonitoring(mpvProcess);
          
          // Set up process event handlers
          this.setupMpvEventHandlers(mpvProcess);

          resolve({ success: true, value: mpvProcess });
        };

        // Handle startup failure
        const onError = (error: Error) => {
          if (resolved) return;
          resolved = true;
          
          console.error('MPV startup failed:', error);
          resolve({ success: false, error: 'PROCESS_START_FAILED' });
        };

        // Handle process exit during startup
        const onExit = (code: number | null) => {
          if (resolved) return;
          resolved = true;
          
          console.error('MPV exited during startup with code:', code);
          resolve({ success: false, error: 'PROCESS_START_FAILED' });
        };

        // Set up startup event handlers
        mpvProcess.on('error', onError);
        mpvProcess.on('exit', onExit);

        // Give mpv a moment to start up, then check if it's running
        setTimeout(() => {
          if (!resolved && mpvProcess.pid && !mpvProcess.killed) {
            onReady();
          } else if (!resolved) {
            onError(new Error('MPV failed to start within timeout'));
          }
        }, 1000);
      });

    } catch (error) {
      console.error('Failed to start MPV:', error);
      return { success: false, error: 'PROCESS_START_FAILED' };
    }
  }

  /**
   * Stop MPV process
   * Requirements: 2.7, 7.3, 7.4
   */
  async stopMpv(): Promise<Result<void, ProcessError>> {
    try {
      if (!this.mpvProcess) {
        return { success: true, value: undefined };
      }

      const process = this.mpvProcess;
      this.mpvProcess = null;
      this.mpvOptions = null;

      // Remove from health monitoring
      if (process.pid) {
        this.processHealth.delete(process.pid);
      }

      // Graceful shutdown
      return new Promise((resolve) => {
        let resolved = false;

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          resolve({ success: true, value: undefined });
        };

        // Handle process exit
        process.on('exit', cleanup);

        // Try graceful termination first
        if (!process.killed) {
          process.kill('SIGTERM');
        }

        // Force kill after timeout
        setTimeout(() => {
          if (!resolved && !process.killed) {
            process.kill('SIGKILL');
          }
          cleanup();
        }, 5000);
      });

    } catch (error) {
      console.error('Failed to stop MPV:', error);
      return { success: false, error: 'PROCESS_CRASHED' };
    }
  }

  /**
   * Restart MPV process
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  async restartMpv(): Promise<Result<ChildProcess, ProcessError>> {
    try {
      // Stop current process
      const stopResult = await this.stopMpv();
      if (!stopResult.success) {
        return { success: false, error: stopResult.error };
      }

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start new process with same options
      if (!this.mpvOptions) {
        return { success: false, error: 'PROCESS_START_FAILED' };
      }

      return await this.startMpv(this.mpvOptions);

    } catch (error) {
      console.error('Failed to restart MPV:', error);
      return { success: false, error: 'PROCESS_START_FAILED' };
    }
  }

  /**
   * Run yt-dlp process to resolve stream
   * Requirements: 1.1, 1.6, 1.7, 7.1, 7.2
   */
  async runYtDlp(url: string, options: YtDlpOptions): Promise<Result<ResolvedStream, ProcessError>> {
    try {
      // Check concurrent process limit
      // Requirements: 6.2, 7.7
      if (this.runningYtDlpProcesses.size >= this.limits.maxConcurrent) {
        return { success: false, error: 'RESOURCE_LIMIT_EXCEEDED' };
      }

      // Validate yt-dlp executable exists
      // Requirements: 7.5, 7.6
      const ytDlpValidation = await this.validateExecutable('yt-dlp');
      if (!ytDlpValidation.success) {
        return { success: false, error: 'DEPENDENCY_MISSING' };
      }

      // Prepare yt-dlp arguments
      const args = [
        '--format', options.format,
        '--no-playlist',
        '--no-flat-playlist', // Fully extract video information
        '--print', '%(url)s',
        '--print', '%(title)s', 
        '--print', '%(duration)s',
        '--print', '%(format)s',
        '--print', '%(quality)s',
        url
      ];

      // Spawn options with timeout
      const spawnOptions: SpawnOptions = {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout
      };

      // Spawn yt-dlp process
      const ytDlpProcess = spawn('yt-dlp', args, spawnOptions);
      this.runningYtDlpProcesses.add(ytDlpProcess);

      // Handle process completion
      return new Promise((resolve) => {
        let resolved = false;
        let stdout = '';
        let stderr = '';

        const cleanup = () => {
          this.runningYtDlpProcesses.delete(ytDlpProcess);
        };

        const resolveResult = (result: Result<ResolvedStream, ProcessError>) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(result);
        };

        // Collect output
        ytDlpProcess.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        ytDlpProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        // Handle process completion
        ytDlpProcess.on('exit', (code) => {
          if (code === 0) {
            // Parse successful output
            const lines = stdout.trim().split('\n');
            if (lines.length >= 5) {
              const resolvedStream: ResolvedStream = {
                streamUrl: lines[0],
                title: lines[1],
                duration: parseInt(lines[2]) || 0,
                format: lines[3],
                quality: lines[4]
              };
              resolveResult({ success: true, value: resolvedStream });
            } else {
              console.error('yt-dlp output parsing failed:', stdout);
              resolveResult({ success: false, error: 'PROCESS_CRASHED' });
            }
          } else {
            console.error('yt-dlp failed with code:', code, 'stderr:', stderr);
            resolveResult({ success: false, error: 'PROCESS_CRASHED' });
          }
        });

        // Handle process errors
        ytDlpProcess.on('error', (error) => {
          console.error('yt-dlp process error:', error);
          resolveResult({ success: false, error: 'PROCESS_START_FAILED' });
        });

        // Handle timeout
        setTimeout(() => {
          if (!resolved) {
            ytDlpProcess.kill('SIGKILL');
            resolveResult({ success: false, error: 'PROCESS_TIMEOUT' });
          }
        }, options.timeout);
      });

    } catch (error) {
      console.error('Failed to run yt-dlp:', error);
      return { success: false, error: 'PROCESS_START_FAILED' };
    }
  }

  /**
   * Check if a process is healthy and responsive
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  isProcessHealthy(process: ChildProcess): boolean {
    if (!process.pid || process.killed || process.exitCode !== null) {
      return false;
    }

    const health = this.processHealth.get(process.pid);
    if (!health) {
      return false;
    }

    // Check if process is responsive (health check within last 30 seconds)
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - health.lastHealthCheck.getTime();
    const isRecent = timeSinceLastCheck < 30000;

    // Check memory usage
    const memoryOk = health.memoryUsageMB < this.limits.maxMemoryMB;

    return health.isResponsive && isRecent && memoryOk;
  }

  /**
   * Clean up all managed processes
   * Requirements: 6.5, 7.4
   */
  async cleanup(): Promise<void> {
    try {
      // Run custom cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          console.error('Cleanup handler failed:', error);
        }
      }

      // Stop MPV process
      if (this.mpvProcess) {
        await this.stopMpv();
      }

      // Kill all running yt-dlp processes
      for (const process of this.runningYtDlpProcesses) {
        try {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        } catch (error) {
          console.error('Failed to kill yt-dlp process:', error);
        }
      }
      this.runningYtDlpProcesses.clear();

      // Clear health monitoring
      this.processHealth.clear();

    } catch (error) {
      console.error('Process cleanup failed:', error);
    }
  }

  /**
   * Validate external dependencies are available
   * Requirements: 7.5, 7.6
   */
  async validateDependencies(): Promise<Result<void, ProcessError>> {
    try {
      // Check mpv
      const mpvResult = await this.validateExecutable('mpv');
      if (!mpvResult.success) {
        console.log("MPV was not found")
        return { success: false, error: 'DEPENDENCY_MISSING' };
      }
      console.log("MPV Was Found")

      // Check yt-dlp
      const ytDlpResult = await this.validateExecutable('yt-dlp');
      if (!ytDlpResult.success) {
        console.log("yt-dlp was not found")
        return { success: false, error: 'DEPENDENCY_MISSING' };
      }
      console.log("yt-dpl was found")

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Dependency validation failed:', error);
      return { success: false, error: 'DEPENDENCY_MISSING' };
    }
  }

  /**
   * Validate that an executable is available in PATH
   * Requirements: 7.5, 7.6
   */
  private async validateExecutable(executable: string): Promise<Result<void, ProcessError>> {
    return new Promise((resolve) => {
      const process = spawn(executable, ['--version'], { 
        stdio: 'ignore',
        timeout: 5000
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve({ success: true, value: undefined });
        } else {
          resolve({ success: false, error: 'DEPENDENCY_MISSING' });
        }
      });

      process.on('error', () => {
        resolve({ success: false, error: 'DEPENDENCY_MISSING' });
      });
    });
  }

  /**
   * Start health monitoring for a process
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  private startHealthMonitoring(process: ChildProcess): void {
    if (!process.pid) return;

    const pid = process.pid;
    const startTime = new Date();

    // Initialize health record
    this.processHealth.set(pid, {
      pid,
      startTime,
      lastHealthCheck: startTime,
      isResponsive: true,
      memoryUsageMB: 0
    });

    // Set up periodic health checks
    const healthCheckInterval = setInterval(async () => {
      try {
        if (process.killed || process.exitCode !== null) {
          clearInterval(healthCheckInterval);
          this.processHealth.delete(pid);
          return;
        }

        // Check memory usage (simplified - in production would use process.memoryUsage())
        const memoryUsageMB = 10; // Placeholder - would get actual memory usage

        // Update health record
        this.processHealth.set(pid, {
          pid,
          startTime,
          lastHealthCheck: new Date(),
          isResponsive: true,
          memoryUsageMB
        });

        // Check if memory limit exceeded
        if (memoryUsageMB > this.limits.maxMemoryMB) {
          console.warn(`Process ${pid} exceeding memory limit: ${memoryUsageMB}MB`);
          // Could trigger restart here if needed
        }

      } catch (error) {
        console.error('Health check failed for process:', pid, error);
        this.processHealth.delete(pid);
        clearInterval(healthCheckInterval);
      }
    }, 10000); // Check every 10 seconds

    // Clean up interval when process exits
    process.on('exit', () => {
      clearInterval(healthCheckInterval);
      this.processHealth.delete(pid);
    });
  }

  /**
   * Set up event handlers for MPV process
   * Requirements: 2.7, 5.3, 7.3, 7.4
   */
  private setupMpvEventHandlers(process: ChildProcess): void {
    // Handle process exit
    process.on('exit', (code, signal) => {
      console.log(`MPV process exited with code ${code}, signal ${signal}`);
      this.mpvProcess = null;
      this.mpvOptions = null;
      
      if (process.pid) {
        this.processHealth.delete(process.pid);
      }
    });

    // Handle process errors
    process.on('error', (error) => {
      console.error('MPV process error:', error);
    });

    // Handle stdout/stderr for debugging
    process.stdout?.on('data', (data) => {
      console.log('MPV stdout:', data.toString().trim());
    });

    process.stderr?.on('data', (data) => {
      console.error('MPV stderr:', data.toString().trim());
    });
  }

  /**
   * Synchronous cleanup for process exit
   * Requirements: 6.5, 7.4
   */
  private syncCleanup(): void {
    try {
      // Kill MPV process synchronously
      if (this.mpvProcess && !this.mpvProcess.killed) {
        this.mpvProcess.kill('SIGKILL');
      }

      // Kill all yt-dlp processes synchronously
      for (const process of this.runningYtDlpProcesses) {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }
    } catch (error) {
      console.error('Synchronous cleanup failed:', error);
    }
  }

  /**
   * Add a custom cleanup handler
   * Requirements: 6.5, 7.4
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.add(handler);
  }

  /**
   * Remove a custom cleanup handler
   */
  removeCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.delete(handler);
  }
}