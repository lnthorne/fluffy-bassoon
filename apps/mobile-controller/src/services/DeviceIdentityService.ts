export interface DeviceIdentityConfig {
  storageKey: string;
  keyPrefix: string;
}

export class DeviceIdentityService {
  private config: DeviceIdentityConfig;
  private cachedDeviceId: string | null = null;

  constructor(config: Partial<DeviceIdentityConfig> = {}) {
    this.config = {
      storageKey: config.storageKey || 'device-id',
      keyPrefix: config.keyPrefix || 'party-jukebox-',
      ...config
    };
  }

  /**
   * Get the unique device ID for this browser session
   * Generates a new one if none exists
   */
  getDeviceId(): string {
    // Return cached ID if available
    if (this.cachedDeviceId) {
      return this.cachedDeviceId;
    }

    // Try to load from localStorage
    const storedId = this.loadDeviceIdFromStorage();
    if (storedId) {
      this.cachedDeviceId = storedId;
      return storedId;
    }

    // Generate new device ID
    const newId = this.generateNewDeviceId();
    this.cachedDeviceId = newId;
    this.saveDeviceIdToStorage(newId);
    
    return newId;
  }

  /**
   * Generate a new unique device ID
   */
  generateNewDeviceId(): string {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback for older browsers
    return this.generateFallbackUUID();
  }

  /**
   * Force generation of a new device ID
   * This will replace any existing ID
   */
  regenerateDeviceId(): string {
    const newId = this.generateNewDeviceId();
    this.cachedDeviceId = newId;
    this.saveDeviceIdToStorage(newId);
    return newId;
  }

  /**
   * Clear the device ID (for testing or reset purposes)
   */
  clearDeviceId(): void {
    this.cachedDeviceId = null;
    this.removeDeviceIdFromStorage();
  }

  /**
   * Check if a device ID exists
   */
  hasDeviceId(): boolean {
    return this.cachedDeviceId !== null || this.loadDeviceIdFromStorage() !== null;
  }

  /**
   * Load device ID from localStorage
   */
  private loadDeviceIdFromStorage(): string | null {
    try {
      const key = this.getStorageKey();
      const storedId = localStorage.getItem(key);
      
      // Validate the stored ID format (basic UUID validation)
      if (storedId && this.isValidUUID(storedId)) {
        return storedId;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to load device ID from storage:', error);
      return null;
    }
  }

  /**
   * Save device ID to localStorage
   */
  private saveDeviceIdToStorage(deviceId: string): void {
    try {
      const key = this.getStorageKey();
      localStorage.setItem(key, deviceId);
    } catch (error) {
      console.warn('Failed to save device ID to storage:', error);
      // Don't throw - the device ID will still work for this session
    }
  }

  /**
   * Remove device ID from localStorage
   */
  private removeDeviceIdFromStorage(): void {
    try {
      const key = this.getStorageKey();
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove device ID from storage:', error);
    }
  }

  /**
   * Get the full storage key with prefix
   */
  private getStorageKey(): string {
    return `${this.config.keyPrefix}${this.config.storageKey}`;
  }

  /**
   * Basic UUID format validation
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Fallback UUID generation for older browsers
   */
  private generateFallbackUUID(): string {
    // Generate a UUID v4-like string using Math.random()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Default instance
export const deviceIdentityService = new DeviceIdentityService();