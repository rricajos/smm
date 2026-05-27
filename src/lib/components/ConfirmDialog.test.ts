// @vitest-environment jsdom
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../test-utils';

// Mock i18n to avoid browser.storage dependency
function mockReadable<T>(value: T) {
  return {
    subscribe: (fn: (v: T) => void) => {
      fn(value);
      return () => {};
    },
  };
}

vi.mock('../i18n', () => ({
  t: mockReadable((key: string) => key),
  locale: mockReadable('en'),
}));

import ConfirmDialog from './ConfirmDialog.svelte';

afterEach(() => cleanup());

const baseProps = {
  title: 'Confirm Delete',
  message: 'Are you sure?',
  onconfirm: vi.fn(),
  oncancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('does not render when show=false', () => {
    render(ConfirmDialog, { ...baseProps, show: false });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders when show=true', () => {
    render(ConfirmDialog, { ...baseProps, show: true });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('displays title and message', () => {
    render(ConfirmDialog, { ...baseProps, show: true });
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders default button labels from i18n keys', () => {
    render(ConfirmDialog, { ...baseProps, show: true });
    // i18n mock returns the key itself, so buttons show the translation keys
    expect(screen.getByText('common_cancel')).toBeInTheDocument();
    expect(screen.getByText('common_delete')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(ConfirmDialog, {
      ...baseProps,
      show: true,
      confirmLabel: 'Yes, remove',
      cancelLabel: 'No, keep',
    });
    expect(screen.getByText('Yes, remove')).toBeInTheDocument();
    expect(screen.getByText('No, keep')).toBeInTheDocument();
  });

  it('calls onconfirm when confirm button clicked', async () => {
    const onconfirm = vi.fn();
    render(ConfirmDialog, { ...baseProps, show: true, onconfirm });
    await fireEvent.click(screen.getByText('common_delete'));
    expect(onconfirm).toHaveBeenCalledOnce();
  });

  it('calls oncancel when cancel button clicked', async () => {
    const oncancel = vi.fn();
    render(ConfirmDialog, { ...baseProps, show: true, oncancel });
    await fireEvent.click(screen.getByText('common_cancel'));
    expect(oncancel).toHaveBeenCalledOnce();
  });

  it('calls oncancel on Escape key', async () => {
    const oncancel = vi.fn();
    render(ConfirmDialog, { ...baseProps, show: true, oncancel });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalledOnce();
  });

  it('has correct aria attributes', () => {
    render(ConfirmDialog, { ...baseProps, show: true });
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-msg');
  });
});
