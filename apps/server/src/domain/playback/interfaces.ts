/**
 * Core interfaces for the Music Resolution & Playback system
 * Following clean architecture principles with ports & adapters pattern
 * Requirements: 7.5, 7.6
 */

import { Result } from '@party-jukebox/shared';
import { QueueItem } from '@party-jukebox/shared';
import { ChildProcess } from 'child_process';
import {
  PlaybackState,
  ResolvedStream,
  YtDlpOptions,
  MpvOptions,
  MPVCommand,
  MPVResponse,
  PlaybackEventListener,
  IPCEventListener
} from './types';
import {
  ResolutionError,
  PlaybackError,
  ProcessError,
  OrchestrationError
} from './errors';

/**
 * Stream resolver interface for YouTube URL resolution
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */
export interface IStreamResolver {
  /**
   * Resolve a YouTube URL to a playable stream
   * Requirements: 1.1, 1.2, 1.3, 1.5
   */
  resolveStream(youtubeUrl: string): Promise<Result<ResolvedStream, ResolutionError>>;

  /**
   * Validate that a stream URL is accessible
   * Requirements: 1.5
   */
  validateStream(streamUrl: string): Promise<boolean>;

  /**
   * Clear the resolution cache
   * Requirements: 6.1
   */
  clearCache(): void;
}

/**
 * Playback controller interface for MPV control
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */
export interface IPlaybackController {
  /**
   * Load and start playing a stream URL
   * Requirements: 2.1
   */
  loadAndPlay(streamUrl: string): Promise<Result<void, PlaybackError>>;

  /**
   * Pause current playback
   * Requirements: 2.3
   */
  pause(): Promise<Result<void, PlaybackError>>;

  /**
   * Resume paused playback
   * Requirements: 2.3
   */
  resume(): Promise<Result<void, PlaybackError>>;

  /**
   * Stop current playback
   * Requirements: 2.3
   */
  stop(): Promise<Result<void, PlaybackError>>;

  /**
   * Set playback volume (optional - for future admin functionality)
   * Requirements: 2.3
   */
  setVolume?(level: number): Promise<Result<void, PlaybackError>>;

  /**
   * Get current playback position in seconds
   * Requirements: 2.6
   */
  getPosition(): Promise<number>;

  /**
   * Get total duration in seconds
   * Requirements: 2.6
   */
  getDuration(): Promise<number>;

  /**
   * Check if currently playing
   * Requirements: 4.1, 4.6
   */
  isPlaying(): boolean;

  /**
   * Get current complete playback state
   * Requirements: 4.1, 4.2, 4.3, 4.6
   */
  getCurrentState(): PlaybackState;

  /**
   * Add event listener for playback events
   * Requirements: 2.4, 2.5, 4.2, 4.4, 5.7
   */
  addEventListener(listener: PlaybackEventListener): void;

  /**
   * Remove event listener
   */
  removeEventListener(listener: PlaybackEventListener): void;
}

/**
 * IPC client interface for MPV communication
 * Requirements: 2.2, 2.6
 */
export interface IIPCClient {
  /**
   * Connect to MPV via Unix socket
   * Requirements: 2.2
   */
  connect(socketPath: string): Promise<void>;

  /**
   * Disconnect from MPV
   * Requirements: 2.2
   */
  disconnect(): Promise<void>;

  /**
   * Send command to MPV and get response
   * Requirements: 2.2, 2.6
   */
  sendCommand(command: MPVCommand): Promise<MPVResponse>;

  /**
   * Check if connection is active
   * Requirements: 2.6, 2.7
   */
  isConnected(): boolean;

  /**
   * Add event listener for IPC events
   * Requirements: 2.6
   */
  addEventListener(listener: IPCEventListener): void;

  /**
   * Remove event listener
   */
  removeEventListener(listener: IPCEventListener): void;
}

/**
 * Process manager interface for external process lifecycle
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.7
 */
export interface IProcessManager {
  /**
   * Start MPV process with specified options
   * Requirements: 2.1, 2.7, 7.1, 7.2
   */
  startMpv(options: MpvOptions): Promise<Result<ChildProcess, ProcessError>>;

  /**
   * Stop MPV process
   * Requirements: 2.7, 7.3, 7.4
   */
  stopMpv(): Promise<Result<void, ProcessError>>;

  /**
   * Restart MPV process
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  restartMpv(): Promise<Result<ChildProcess, ProcessError>>;

  /**
   * Run yt-dlp process to resolve stream
   * Requirements: 1.1, 1.6, 1.7, 7.1, 7.2
   */
  runYtDlp(url: string, options: YtDlpOptions): Promise<Result<ResolvedStream, ProcessError>>;

  /**
   * Check if a process is healthy and responsive
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  isProcessHealthy(process: ChildProcess): boolean;

  /**
   * Clean up all managed processes
   * Requirements: 6.5, 7.4
   */
  cleanup(): Promise<void>;

  /**
   * Validate external dependencies are available
   * Requirements: 7.5, 7.6
   */
  validateDependencies(): Promise<Result<void, ProcessError>>;
}

/**
 * Playback orchestrator interface for high-level coordination
 * Requirements: 3.1, 3.2, 3.4, 3.6, 4.1, 4.3
 */
export interface IPlaybackOrchestrator {
  /**
   * Start the orchestrator and begin monitoring queue
   * Requirements: 3.1, 3.6
   */
  start(): Promise<Result<void, OrchestrationError>>;

  /**
   * Stop the orchestrator and cleanup
   * Requirements: 3.4
   */
  stop(): Promise<Result<void, OrchestrationError>>;

  /**
   * Pause current playback
   * Requirements: 2.3, 4.5
   */
  pause(): Promise<Result<void, OrchestrationError>>;

  /**
   * Resume paused playback
   * Requirements: 2.3, 4.5
   */
  resume(): Promise<Result<void, OrchestrationError>>;

  /**
   * Skip to next track
   * Requirements: 3.2, 3.3, 5.1, 5.2
   */
  skip(): Promise<Result<void, OrchestrationError>>;

  /**
   * Set volume (optional - for future admin functionality)
   * Requirements: 2.3
   */
  setVolume?(level: number): Promise<Result<void, OrchestrationError>>;

  /**
   * Get current playback state
   * Requirements: 4.1, 4.2, 4.3, 4.6
   */
  getCurrentState(): PlaybackState;

  /**
   * Add event listener for orchestrator events
   * Requirements: 4.2, 4.4, 5.7
   */
  addEventListener(listener: PlaybackEventListener): void;

  /**
   * Remove event listener
   */
  removeEventListener(listener: PlaybackEventListener): void;
}