/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

// Conditionally import jest-dom matchers (only meaningful in jsdom environment)
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

export {};
