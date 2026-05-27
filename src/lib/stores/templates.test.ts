/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { ResponseTemplate } from '../../types/templates';

let mockStorage: Record<string, unknown> = {};

vi.stubGlobal('browser', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mockStorage ? { [key]: mockStorage[key] } : {})),
      set: vi.fn(async (data: Record<string, unknown>) => Object.assign(mockStorage, data)),
    },
    onChanged: { addListener: vi.fn() },
  },
});

import { templates } from './templates';

function makeTmpl(overrides: Partial<ResponseTemplate> = {}): ResponseTemplate {
  return {
    id: 't1',
    name: 'Auto Reply',
    subject: 'Re: {{original_subject}}',
    body: 'Thank you for your email.',
    isPlainText: true,
    sendMode: 'draft',
    replyType: 'replyToSender',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
  templates.setTemplates([]);
});

describe('templates store', () => {
  it('has empty array as default', () => {
    expect(get(templates)).toEqual([]);
  });

  it('addTemplate() appends and persists', async () => {
    await templates.addTemplate(makeTmpl({ id: 't1' }));
    expect(get(templates)).toHaveLength(1);
    expect(get(templates)[0].name).toBe('Auto Reply');
  });

  it('updateTemplate() merges partial by id', async () => {
    await templates.addTemplate(makeTmpl({ id: 't1', name: 'Original' }));
    await templates.updateTemplate('t1', { name: 'Updated' });
    expect(get(templates)[0].name).toBe('Updated');
  });

  it('updateTemplate() does not modify other templates', async () => {
    await templates.addTemplate(makeTmpl({ id: 't1', name: 'A' }));
    await templates.addTemplate(makeTmpl({ id: 't2', name: 'B' }));
    await templates.updateTemplate('t1', { name: 'A-updated' });
    expect(get(templates)[1].name).toBe('B');
  });

  it('deleteTemplate() removes by id', async () => {
    await templates.addTemplate(makeTmpl({ id: 't1' }));
    await templates.addTemplate(makeTmpl({ id: 't2' }));
    await templates.deleteTemplate('t1');
    expect(get(templates)).toHaveLength(1);
    expect(get(templates)[0].id).toBe('t2');
  });

  it('deleteTemplate() is a no-op for nonexistent id', async () => {
    await templates.addTemplate(makeTmpl({ id: 't1' }));
    await templates.deleteTemplate('nonexistent');
    expect(get(templates)).toHaveLength(1);
  });

  it('setTemplates() replaces all', async () => {
    await templates.addTemplate(makeTmpl({ id: 'old' }));
    await templates.setTemplates([makeTmpl({ id: 'new1' }), makeTmpl({ id: 'new2' })]);
    expect(get(templates)).toHaveLength(2);
    expect(get(templates)[0].id).toBe('new1');
  });
});
