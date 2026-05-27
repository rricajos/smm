/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('info logs with [SMM] prefix', () => {
    logger.info('test message');
    expect(console.log).toHaveBeenCalledWith('[SMM]', 'test message');
  });

  it('warn logs with [SMM] prefix', () => {
    logger.warn('warning message');
    expect(console.warn).toHaveBeenCalledWith('[SMM]', 'warning message');
  });

  it('error logs context and error message', () => {
    logger.error('context', new Error('boom'));
    expect(console.error).toHaveBeenCalledWith('[SMM]', 'context', 'boom');
  });

  it('error handles non-Error objects', () => {
    logger.error('context', 'string error');
    expect(console.error).toHaveBeenCalledWith('[SMM]', 'context', 'string error');
  });

  it('error handles missing error argument', () => {
    logger.error('context');
    expect(console.error).toHaveBeenCalledWith('[SMM]', 'context', '');
  });

  it('debug logs with [SMM] prefix', () => {
    logger.debug('debug info', { key: 'value' });
    expect(console.debug).toHaveBeenCalledWith('[SMM]', 'debug info', { key: 'value' });
  });

  it('info accepts multiple arguments', () => {
    logger.info('a', 'b', 'c');
    expect(console.log).toHaveBeenCalledWith('[SMM]', 'a', 'b', 'c');
  });
});
