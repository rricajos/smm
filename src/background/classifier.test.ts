/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { matchString, hasNestedQuantifiers } from './classifier';

describe('matchString', () => {
  describe('contains', () => {
    it('matches substring (case-insensitive)', () => {
      expect(matchString('Hello World', 'contains', 'world', false)).toBe(true);
    });
    it('does not match absent substring', () => {
      expect(matchString('Hello World', 'contains', 'foo', false)).toBe(false);
    });
    it('matches substring (case-sensitive)', () => {
      expect(matchString('Hello World', 'contains', 'World', true)).toBe(true);
    });
    it('rejects wrong case when case-sensitive', () => {
      expect(matchString('Hello World', 'contains', 'world', true)).toBe(false);
    });
    it('handles empty needle', () => {
      expect(matchString('anything', 'contains', '', false)).toBe(true);
    });
  });

  describe('equals', () => {
    it('matches exact string (case-insensitive)', () => {
      expect(matchString('hello', 'equals', 'HELLO', false)).toBe(true);
    });
    it('rejects partial match', () => {
      expect(matchString('hello world', 'equals', 'hello', false)).toBe(false);
    });
    it('matches exact (case-sensitive)', () => {
      expect(matchString('Hello', 'equals', 'Hello', true)).toBe(true);
    });
    it('rejects different case when case-sensitive', () => {
      expect(matchString('Hello', 'equals', 'hello', true)).toBe(false);
    });
  });

  describe('startsWith', () => {
    it('matches prefix', () => {
      expect(matchString('newsletter@example.com', 'startsWith', 'newsletter', false)).toBe(true);
    });
    it('rejects non-prefix', () => {
      expect(matchString('newsletter@example.com', 'startsWith', 'example', false)).toBe(false);
    });
  });

  describe('endsWith', () => {
    it('matches suffix', () => {
      expect(matchString('user@example.com', 'endsWith', '@example.com', false)).toBe(true);
    });
    it('rejects non-suffix', () => {
      expect(matchString('user@example.com', 'endsWith', '@other.com', false)).toBe(false);
    });
  });

  describe('matches (regex)', () => {
    it('matches simple regex', () => {
      expect(matchString('Invoice #12345', 'matches', 'Invoice #\\d+', false)).toBe(true);
    });
    it('rejects non-matching regex', () => {
      expect(matchString('Hello World', 'matches', '^\\d+$', false)).toBe(false);
    });
    it('returns false for invalid regex', () => {
      expect(matchString('test', 'matches', '[invalid', false)).toBe(false);
    });
    it('blocks nested quantifiers', () => {
      expect(matchString('aaaaaaaaa', 'matches', '(a+)+$', false)).toBe(false);
    });
    it('truncates very long input', () => {
      const longString = 'a'.repeat(20000);
      // Should not hang — input is truncated to 10000 chars
      expect(matchString(longString, 'matches', '^a+$', false)).toBe(true);
    });
  });

  describe('unknown operator', () => {
    it('returns false', () => {
      expect(matchString('test', 'unknown' as any, 'test', false)).toBe(false);
    });
  });
});

describe('hasNestedQuantifiers', () => {
  it('detects (a+)+', () => {
    expect(hasNestedQuantifiers('(a+)+')).toBe(true);
  });
  it('detects (a*)+', () => {
    expect(hasNestedQuantifiers('(a*)+')).toBe(true);
  });
  it('detects (a{2})+', () => {
    expect(hasNestedQuantifiers('(a{2})+')).toBe(true);
  });
  it('allows simple quantifiers', () => {
    expect(hasNestedQuantifiers('a+')).toBe(false);
  });
  it('allows non-nested groups', () => {
    expect(hasNestedQuantifiers('(abc)+')).toBe(false);
  });
  it('allows alternation groups', () => {
    expect(hasNestedQuantifiers('(a|b)+')).toBe(false);
  });
});
