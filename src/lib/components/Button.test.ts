// @vitest-environment jsdom
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../test-utils';
import { createRawSnippet } from 'svelte';
import Button from './Button.svelte';

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

afterEach(() => cleanup());

describe('Button', () => {
  it('renders with text content', () => {
    render(Button, { children: textSnippet('Click me') });
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(Button, { children: textSnippet('Test') });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies primary variant class', () => {
    render(Button, { variant: 'primary', children: textSnippet('Primary') });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('btn-primary');
  });

  it('applies secondary variant by default', () => {
    render(Button, { children: textSnippet('Default') });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('btn-secondary');
  });

  it('applies danger variant class', () => {
    render(Button, { variant: 'danger', children: textSnippet('Delete') });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('btn-danger');
  });

  it('applies ghost variant class', () => {
    render(Button, { variant: 'ghost', children: textSnippet('Ghost') });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('btn-ghost');
  });

  it('applies size classes', () => {
    render(Button, { size: 'xs', children: textSnippet('Tiny') });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('btn-xs');
  });

  it('renders as disabled', () => {
    render(Button, { disabled: true, children: textSnippet('Disabled') });
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('calls onclick handler when clicked', async () => {
    const handler = vi.fn();
    render(Button, { onclick: handler, children: textSnippet('Click') });
    await fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });
});
