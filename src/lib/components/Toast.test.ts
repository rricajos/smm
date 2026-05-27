// @vitest-environment jsdom
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../test-utils';

// Mock i18n to avoid browser.storage dependency
function mockReadable<T>(value: T) {
  return { subscribe: (fn: (v: T) => void) => { fn(value); return () => {}; } };
}

vi.mock('../i18n', () => ({
  t: mockReadable((key: string) => key),
  locale: mockReadable('en'),
}));

import Toast from './Toast.svelte';

afterEach(() => cleanup());

describe('Toast', () => {
  it('does not render when show=false', () => {
    render(Toast, { show: false, message: 'Hello' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders message when show=true', () => {
    render(Toast, { show: true, message: 'Success!' });
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('has alert role', () => {
    render(Toast, { show: true, message: 'Alert msg' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies success type class', () => {
    render(Toast, { show: true, message: 'Done', type: 'success' });
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('toast-success');
  });

  it('applies error type class', () => {
    render(Toast, { show: true, message: 'Error', type: 'error' });
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('toast-error');
  });

  it('applies info type by default', () => {
    render(Toast, { show: true, message: 'Info' });
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('toast-info');
  });

  it('renders action button when actionLabel provided', () => {
    const onaction = vi.fn();
    render(Toast, { show: true, message: 'Undo?', actionLabel: 'Undo', onaction });
    expect(screen.getByText('Undo')).toBeInTheDocument();
  });

  it('calls ondismiss on dismiss button click', async () => {
    const ondismiss = vi.fn();
    render(Toast, { show: true, message: 'Closable', ondismiss });
    const dismissBtn = screen.getByLabelText('toast_dismiss');
    await fireEvent.click(dismissBtn);
    expect(ondismiss).toHaveBeenCalledOnce();
  });
});
