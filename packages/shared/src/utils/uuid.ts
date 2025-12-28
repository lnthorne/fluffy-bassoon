/**
 * Cross-platform UUID generation utility
 * Provides fallback for browsers that don't support crypto.randomUUID()
 */

/**
 * Generate a UUID v4 string with fallback for older browsers
 */
export function generateUUID(): string {
  // Use crypto.randomUUID() if available (modern browsers and Node.js)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers using Math.random()
  return generateFallbackUUID();
}

/**
 * Fallback UUID generation using Math.random()
 * Generates a UUID v4-like string
 */
function generateFallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}