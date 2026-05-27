/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

/** Extract a human-readable message from an unknown error. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}
