/**
 * Music Resolution & Playback domain exports
 * Requirements: 7.5, 7.6
 */

// Core types
export type {
  PlaybackStatus,
  PlaybackState,
  ResolvedStream,
  ResolutionCache,
  YtDlpOptions,
  MpvOptions,
  MPVCommand,
  MPVResponse,
  PlaybackEventType,
  PlaybackEvent,
  PlaybackEventListener,
  IPCEventListener
} from './types';

// Error types
export type {
  ResolutionError,
  PlaybackError,
  ProcessError,
  OrchestrationError,
  PlaybackErrorDetails
} from './errors';

export { PlaybackErrorFactory } from './errors';

// Interfaces
export type {
  IStreamResolver,
  IPlaybackController,
  IIPCClient,
  IProcessManager,
  IPlaybackOrchestrator
} from './interfaces';