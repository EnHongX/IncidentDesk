import { describe, it, expect } from 'vitest';
import { getTransition } from '../src/state-machine.js';

describe('State Machine', () => {
  describe('CLAIM action', () => {
    it('allows NEW → CLAIMED', () => {
      const result = getTransition('CLAIM', 'NEW');
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.to).toBe('CLAIMED');
    });

    it('rejects CLAIMED → CLAIMED', () => {
      const result = getTransition('CLAIM', 'CLAIMED');
      expect(result.valid).toBe(false);
    });

    it('rejects PROCESSING → CLAIMED', () => {
      const result = getTransition('CLAIM', 'PROCESSING');
      expect(result.valid).toBe(false);
    });

    it('rejects RESOLVED → CLAIMED', () => {
      const result = getTransition('CLAIM', 'RESOLVED');
      expect(result.valid).toBe(false);
    });
  });

  describe('START action', () => {
    it('allows CLAIMED → PROCESSING', () => {
      const result = getTransition('START', 'CLAIMED');
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.to).toBe('PROCESSING');
    });

    it('rejects NEW → PROCESSING', () => {
      const result = getTransition('START', 'NEW');
      expect(result.valid).toBe(false);
    });
  });

  describe('RESOLVE action', () => {
    it('allows PROCESSING → RESOLVED', () => {
      const result = getTransition('RESOLVE', 'PROCESSING');
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.to).toBe('RESOLVED');
    });

    it('rejects NEW → RESOLVED', () => {
      const result = getTransition('RESOLVE', 'NEW');
      expect(result.valid).toBe(false);
    });

    it('rejects CLAIMED → RESOLVED', () => {
      const result = getTransition('RESOLVE', 'CLAIMED');
      expect(result.valid).toBe(false);
    });
  });

  describe('FALSE_POSITIVE action', () => {
    it('allows NEW → FALSE_POSITIVE', () => {
      const result = getTransition('FALSE_POSITIVE', 'NEW');
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.to).toBe('FALSE_POSITIVE');
    });

    it('allows CLAIMED → FALSE_POSITIVE', () => {
      const result = getTransition('FALSE_POSITIVE', 'CLAIMED');
      expect(result.valid).toBe(true);
    });

    it('allows PROCESSING → FALSE_POSITIVE', () => {
      const result = getTransition('FALSE_POSITIVE', 'PROCESSING');
      expect(result.valid).toBe(true);
    });

    it('rejects RESOLVED → FALSE_POSITIVE', () => {
      const result = getTransition('FALSE_POSITIVE', 'RESOLVED');
      expect(result.valid).toBe(false);
    });
  });

  describe('Unknown action', () => {
    it('rejects unknown actions', () => {
      const result = getTransition('UNKNOWN', 'NEW');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('Unknown action');
    });
  });

  describe('Full workflow', () => {
    it('supports happy path: NEW → CLAIMED → PROCESSING → RESOLVED', () => {
      let status = 'NEW';

      let r = getTransition('CLAIM', status);
      expect(r.valid).toBe(true);
      if (r.valid) status = r.to;

      r = getTransition('START', status);
      expect(r.valid).toBe(true);
      if (r.valid) status = r.to;

      r = getTransition('RESOLVE', status);
      expect(r.valid).toBe(true);
      if (r.valid) status = r.to;

      expect(status).toBe('RESOLVED');
    });

    it('supports false positive path: NEW → CLAIMED → FALSE_POSITIVE', () => {
      let status = 'NEW';

      let r = getTransition('CLAIM', status);
      expect(r.valid).toBe(true);
      if (r.valid) status = r.to;

      r = getTransition('FALSE_POSITIVE', status);
      expect(r.valid).toBe(true);
      if (r.valid) status = r.to;

      expect(status).toBe('FALSE_POSITIVE');
    });
  });
});
