/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

const PREFIX = '[SMM]';

export const logger = {
  info(...args: unknown[]) {
    console.log(PREFIX, ...args);
  },
  warn(...args: unknown[]) {
    console.warn(PREFIX, ...args);
  },
  error(context: string, err?: unknown) {
    console.error(PREFIX, context, err instanceof Error ? err.message : err ?? '');
  },
  debug(...args: unknown[]) {
    console.debug(PREFIX, ...args);
  },
};
