// @vitest-environment jsdom
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../../lib/test-utils';
import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { ActivityEntry } from '../../types/settings';

function mockReadable<T>(value: T) {
  return {
    subscribe: (fn: (v: T) => void) => {
      fn(value);
      return () => {};
    },
  };
}

vi.mock('../../lib/i18n', () => ({
  t: mockReadable((key: string) => key),
  locale: mockReadable('en'),
}));

import GlobalSearch from './GlobalSearch.svelte';

afterEach(() => cleanup());

const mockRules: Rule[] = [
  {
    id: 'r1',
    name: 'Newsletter filter',
    enabled: true,
    conditions: [
      { field: 'from', operator: 'contains', value: 'newsletter', caseSensitive: false },
    ],
    conditionLogic: 'all',
    actions: [{ type: 'markRead' }],
    stopProcessing: false,
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 'r2',
    name: 'Finance alerts',
    enabled: false,
    conditions: [
      { field: 'subject', operator: 'contains', value: 'invoice', caseSensitive: false },
    ],
    conditionLogic: 'all',
    actions: [{ type: 'addTag', tagKey: 'finance' }],
    stopProcessing: false,
    createdAt: 2000,
    updatedAt: 2000,
  },
];

const mockTemplates: ResponseTemplate[] = [
  {
    id: 't1',
    name: 'Out of office',
    subject: 'Re: {{subject}}',
    body: 'I am out of office.',
    sendMode: 'draft',
    replyType: 'replyToSender',
    isPlainText: true,
  },
];

const mockActivity: ActivityEntry[] = [
  {
    type: 'classification',
    timestamp: 3000,
    subject: 'Meeting tomorrow',
    from: 'boss@example.com',
    ruleName: 'Work emails',
    ruleId: 'r1',
    messageId: 100,
    actions: ['moved'],
  },
];

const baseProps = {
  rules: mockRules,
  templates: mockTemplates,
  activity: mockActivity,
  onnavigate: vi.fn(),
};

describe('GlobalSearch', () => {
  it('renders the search input', () => {
    render(GlobalSearch, baseProps);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows no results on empty query', () => {
    render(GlobalSearch, baseProps);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows rule results when query matches a rule name', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'newsletter' } });
    expect(screen.getByText('Newsletter filter')).toBeInTheDocument();
  });

  it('shows template results when query matches a template name', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'out of' } });
    expect(screen.getByText('Out of office')).toBeInTheDocument();
  });

  it('shows activity log results when query matches an email subject', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'meeting' } });
    expect(screen.getByText('Meeting tomorrow')).toBeInTheDocument();
  });

  it('is case-insensitive in search', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'NEWSLETTER' } });
    expect(screen.getByText('Newsletter filter')).toBeInTheDocument();
  });

  it('shows results from multiple types when query is broad', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    // 'e' matches both 'Newsletter filter' and 'Out of office' and activity
    await fireEvent.input(input, { target: { value: 'finance' } });
    expect(screen.getByText('Finance alerts')).toBeInTheDocument();
  });

  it('hides results on Escape key', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'newsletter' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('calls onnavigate with correct tabId when a result is clicked', async () => {
    const onnavigate = vi.fn();
    render(GlobalSearch, { ...baseProps, onnavigate });
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'newsletter' } });
    const result = screen.getByText('Newsletter filter');
    await fireEvent.mouseDown(result);
    expect(onnavigate).toHaveBeenCalledWith('rules', 'newsletter');
  });

  it('calls onnavigate with templates tabId for template results', async () => {
    const onnavigate = vi.fn();
    render(GlobalSearch, { ...baseProps, onnavigate });
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'out of' } });
    const result = screen.getByText('Out of office');
    await fireEvent.mouseDown(result);
    expect(onnavigate).toHaveBeenCalledWith('templates', 'out of');
  });

  it('navigates results with ArrowDown key', async () => {
    render(GlobalSearch, baseProps);
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'newsletter' } });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('selects highlighted result on Enter', async () => {
    const onnavigate = vi.fn();
    render(GlobalSearch, { ...baseProps, onnavigate });
    const input = screen.getByRole('combobox');
    await fireEvent.focus(input);
    await fireEvent.input(input, { target: { value: 'newsletter' } });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onnavigate).toHaveBeenCalledWith('rules', 'newsletter');
  });
});
