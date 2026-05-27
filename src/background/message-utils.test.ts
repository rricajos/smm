/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { extractBodyText, getHeaderValue, isAutoSubmitted, isMailingList } from './message-utils';

describe('extractBodyText', () => {
  it('returns empty string for null input', () => {
    expect(extractBodyText(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(extractBodyText(undefined)).toBe('');
  });

  it('extracts text/plain body directly', () => {
    const msg = { body: 'Hello world', contentType: 'text/plain' };
    expect(extractBodyText(msg)).toBe('Hello world');
  });

  it('strips HTML tags from text/html body', () => {
    const msg = { body: '<p>Hello <b>world</b></p>', contentType: 'text/html' };
    expect(extractBodyText(msg)).toContain('Hello');
    expect(extractBodyText(msg)).toContain('world');
    expect(extractBodyText(msg)).not.toContain('<');
  });

  it('prefers text/plain part over text/html in multipart', () => {
    const msg = {
      parts: [
        { body: '<p>HTML version</p>', contentType: 'text/html' },
        { body: 'Plain version', contentType: 'text/plain' },
      ],
    } as any;
    expect(extractBodyText(msg)).toBe('Plain version');
  });

  it('falls back to text/html if no text/plain part exists', () => {
    const msg = {
      parts: [
        { body: '<p>Only HTML</p>', contentType: 'text/html' },
      ],
    } as any;
    expect(extractBodyText(msg)).toContain('Only HTML');
  });

  it('handles nested parts recursively', () => {
    const msg = {
      parts: [
        {
          contentType: 'multipart/alternative',
          parts: [
            { body: 'Nested plain', contentType: 'text/plain' },
          ],
        },
      ],
    } as any;
    expect(extractBodyText(msg)).toBe('Nested plain');
  });

  it('returns empty for message with no body and no parts', () => {
    expect(extractBodyText({} as any)).toBe('');
  });
});

describe('getHeaderValue', () => {
  it('returns header value by name (case-insensitive)', () => {
    const msg = { headers: { 'content-type': ['text/plain'] } } as any;
    expect(getHeaderValue(msg, 'Content-Type')).toBe('text/plain');
  });

  it('returns first value if multiple', () => {
    const msg = { headers: { 'received': ['first', 'second'] } } as any;
    expect(getHeaderValue(msg, 'received')).toBe('first');
  });

  it('returns undefined for missing header', () => {
    const msg = { headers: { 'content-type': ['text/plain'] } } as any;
    expect(getHeaderValue(msg, 'x-missing')).toBeUndefined();
  });

  it('returns undefined for null messagePart', () => {
    expect(getHeaderValue(null, 'any')).toBeUndefined();
  });

  it('returns undefined for messagePart without headers', () => {
    expect(getHeaderValue({} as any, 'any')).toBeUndefined();
  });
});

describe('isAutoSubmitted', () => {
  it('returns true for auto-submitted: auto-replied', () => {
    const msg = { headers: { 'auto-submitted': ['auto-replied'] } } as any;
    expect(isAutoSubmitted(msg)).toBe(true);
  });

  it('returns true for auto-submitted: auto-generated', () => {
    const msg = { headers: { 'auto-submitted': ['auto-generated'] } } as any;
    expect(isAutoSubmitted(msg)).toBe(true);
  });

  it('returns false for auto-submitted: no', () => {
    const msg = { headers: { 'auto-submitted': ['no'] } } as any;
    expect(isAutoSubmitted(msg)).toBe(false);
  });

  it('returns true if x-auto-response-suppress header is present', () => {
    const msg = { headers: { 'x-auto-response-suppress': ['All'] } } as any;
    expect(isAutoSubmitted(msg)).toBe(true);
  });

  it('returns false for normal message without auto headers', () => {
    const msg = { headers: { 'from': ['user@example.com'] } } as any;
    expect(isAutoSubmitted(msg)).toBe(false);
  });
});

describe('isMailingList', () => {
  it('returns true if list-unsubscribe header is present', () => {
    const msg = { headers: { 'list-unsubscribe': ['<mailto:unsub@example.com>'] } } as any;
    expect(isMailingList(msg)).toBe(true);
  });

  it('returns false if no list-unsubscribe header', () => {
    const msg = { headers: { 'from': ['user@example.com'] } } as any;
    expect(isMailingList(msg)).toBe(false);
  });

  it('returns false for empty headers', () => {
    const msg = { headers: {} } as any;
    expect(isMailingList(msg)).toBe(false);
  });
});
