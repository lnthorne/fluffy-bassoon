// Type definitions specific to mobile controller
// Shared types are imported from @party-jukebox/shared

export interface UserSession {
  deviceId: string;
  nickname: string;
  createdAt: Date;
  lastActive: Date;
  preferences: {
    autoRefresh: boolean;
    showNotifications: boolean;
  };
}

export interface RateLimitInfo {
  remainingRequests: number;
  timeUntilReset: number; // milliseconds
  maxRequests: number;
  windowDuration: number; // milliseconds
  isLimited: boolean;
}

export interface QueueContribution {
  queueItemId: string;
  position: number;
  addedAt: Date;
  status: 'queued' | 'playing' | 'completed';
}

export interface ConnectionStatus {
  api: {
    connected: boolean;
    lastError?: string;
    retrying: boolean;
  };
  websocket: {
    connected: boolean;
    reconnecting: boolean;
    lastError?: string;
  };
  server: {
    url: string;
    version?: string;
    addresses: string[];
  };
}