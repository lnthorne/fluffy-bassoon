/**
 * Basic setup test to verify TypeScript and Jest configuration
 */

import { TrackValidator, UserValidator, QueueItemValidator } from '../index';

describe('Project Setup', () => {
  test('TypeScript compilation works', () => {
    expect(typeof TrackValidator).toBe('function');
    expect(typeof UserValidator).toBe('function');
    expect(typeof QueueItemValidator).toBe('function');
  });

  test('Jest and fast-check are available', () => {
    const fc = require('fast-check');
    expect(fc).toBeDefined();
    expect(fc.assert).toBeDefined();
    expect(fc.property).toBeDefined();
  });

  test('Crypto UUID mock works', () => {
    const uuid1 = crypto.randomUUID();
    const uuid2 = crypto.randomUUID();
    
    expect(typeof uuid1).toBe('string');
    expect(typeof uuid2).toBe('string');
    expect(uuid1).not.toBe(uuid2);
    expect(uuid1).toMatch(/^test-uuid-/);
  });
});