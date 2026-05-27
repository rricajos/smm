// @vitest-environment jsdom
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../test-utils';
import { createRawSnippet } from 'svelte';

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

import Modal from './Modal.svelte';

function bodySnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<p>${text}</p>`,
  }));
}

afterEach(() => cleanup());

describe('Modal', () => {
  it('does not render when show=false', () => {
    render(Modal, { show: false, title: 'Test', onclose: vi.fn() });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when show=true', () => {
    render(Modal, { show: true, title: 'Test Modal', onclose: vi.fn() });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays title', () => {
    render(Modal, { show: true, title: 'My Title', onclose: vi.fn() });
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(Modal, {
      show: true,
      title: 'Test',
      onclose: vi.fn(),
      children: bodySnippet('Modal body content'),
    });
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('calls onclose on close button click', async () => {
    const onclose = vi.fn();
    render(Modal, { show: true, title: 'Test', onclose });
    // The close button has aria-label from t('common_close') which returns the key
    const closeBtn = screen.getByLabelText('common_close');
    await fireEvent.click(closeBtn);
    expect(onclose).toHaveBeenCalledOnce();
  });

  it('calls onclose on Escape key', async () => {
    const onclose = vi.fn();
    render(Modal, { show: true, title: 'Test', onclose });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).toHaveBeenCalledOnce();
  });

  it('has correct aria attributes', () => {
    render(Modal, { show: true, title: 'Accessible Modal', onclose: vi.fn() });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });
});
