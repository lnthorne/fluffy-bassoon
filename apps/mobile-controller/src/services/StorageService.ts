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

export interface StorageServiceConfig {
  keyPrefix: string;
  sessionKey: string;
}

export class StorageService {
  private config: StorageServiceConfig;
  private isStorageAvailable: boolean;

  constructor(config: Partial<StorageServiceConfig> = {}) {
    this.config = {
      keyPrefix: config.keyPrefix || 'party-jukebox-',
      sessionKey: config.sessionKey || 'user-session',
      ...config
    };
    
    this.isStorageAvailable = this.checkStorageAvailability();
  }

  /**
   * Save user session to localStorage
   */
  saveSession(session: UserSession): void {
    if (!this.isStorageAvailable) {
      console.warn('localStorage not available, session will not persist');
      return;
    }

    try {
      const sessionData = {
        ...session,
        createdAt: session.createdAt.toISOString(),
        lastActive: session.lastActive.toISOString()
      };

      const key = this.getStorageKey(this.config.sessionKey);
      localStorage.setItem(key, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Failed to save session:', error);
      // Gracefully handle storage errors - don't throw
    }
  }

  /**
   * Load user session from localStorage
   */
  loadSession(): UserSession | null {
    if (!this.isStorageAvailable) {
      return null;
    }

    try {
      const key = this.getStorageKey(this.config.sessionKey);
      const sessionData = localStorage.getItem(key);
      
      if (!sessionData) {
        return null;
      }

      const parsed = JSON.parse(sessionData);
      
      // Validate required fields
      if (!parsed.deviceId || !parsed.nickname) {
        console.warn('Invalid session data found, clearing');
        this.clearSession();
        return null;
      }

      return {
        deviceId: parsed.deviceId,
        nickname: parsed.nickname,
        createdAt: new Date(parsed.createdAt),
        lastActive: new Date(parsed.lastActive),
        preferences: {
          autoRefresh: parsed.preferences?.autoRefresh ?? true,
          showNotifications: parsed.preferences?.showNotifications ?? true
        }
      };
    } catch (error) {
      console.error('Failed to load session:', error);
      // Clear corrupted data
      this.clearSession();
      return null;
    }
  }

  /**
   * Clear user session from localStorage
   */
  clearSession(): void {
    if (!this.isStorageAvailable) {
      return;
    }

    try {
      const key = this.getStorageKey(this.config.sessionKey);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear session:', error);
      // Don't throw - clearing should always succeed silently
    }
  }

  /**
   * Update session preferences
   */
  updatePreferences(preferences: Partial<UserSession['preferences']>): void {
    const session = this.loadSession();
    if (!session) {
      return;
    }

    const updatedSession: UserSession = {
      ...session,
      preferences: {
        ...session.preferences,
        ...preferences
      },
      lastActive: new Date()
    };

    this.saveSession(updatedSession);
  }

  /**
   * Update last active timestamp
   */
  updateLastActive(): void {
    const session = this.loadSession();
    if (!session) {
      return;
    }

    const updatedSession: UserSession = {
      ...session,
      lastActive: new Date()
    };

    this.saveSession(updatedSession);
  }

  /**
   * Check if localStorage is available and working
   */
  private checkStorageAvailability(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get prefixed storage key
   */
  private getStorageKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get storage availability status
   */
  isAvailable(): boolean {
    return this.isStorageAvailable;
  }
}

// Default instance
export const storageService = new StorageService();