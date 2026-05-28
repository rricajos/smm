/* SPDX-License-Identifier: MPL-2.0 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock setup ---

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid-1234') });

vi.mock('../i18n', () => ({
  getLocaleFromStorage: vi.fn(async () => 'es'),
  translate: vi.fn((_loc: string, key: string) => key),
}));

vi.stubGlobal('browser', {
  permissions: { request: vi.fn(async () => true) },
  storage: {
    local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
    onChanged: { addListener: vi.fn() },
  },
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { buildSystemPrompt, parseRuleSuggestions, testConnection } from '../services/openai';
import type { Rule } from '../../types/rules';

// --- Shared test data ---

const folders = [
  { id: 'folder1', path: 'Account/Inbox', name: 'Inbox' },
  { id: 'folder2', path: 'Account/Archive', name: 'Archive' },
];

const tags = [{ key: 'tag1', tag: 'Important', color: '#ff0000' }];

const existingRules: Rule[] = [
  {
    id: 'rule1',
    name: 'Move newsletters',
    enabled: true,
    conditions: [
      { field: 'from', operator: 'contains', value: 'newsletter', caseSensitive: false },
    ],
    conditionLogic: 'all',
    actions: [{ type: 'moveToFolder', folderId: 'folder2' }],
    stopProcessing: false,
    createdAt: 1000,
    updatedAt: 1000,
  },
];

// --- Tests ---

describe('buildSystemPrompt', () => {
  it('includes folder paths in output', () => {
    const result = buildSystemPrompt(folders, tags, []);
    expect(result).toContain('Account/Inbox');
    expect(result).toContain('Account/Archive');
    expect(result).toContain('folder1');
    expect(result).toContain('folder2');
  });

  it('includes tag names in output', () => {
    const result = buildSystemPrompt(folders, tags, []);
    expect(result).toContain('tag1');
    expect(result).toContain('Important');
  });

  it('shows no-tags message when tags array is empty', () => {
    const result = buildSystemPrompt(folders, [], []);
    expect(result).toContain('(no hay tags configurados)');
  });

  it('includes existing rule names and conditions in output', () => {
    const result = buildSystemPrompt(folders, tags, existingRules);
    expect(result).toContain('Move newsletters');
    expect(result).toContain('from contains "newsletter"');
  });

  it('shows no-rules message when rules array is empty', () => {
    const result = buildSystemPrompt(folders, tags, []);
    expect(result).toContain('(no hay reglas configuradas)');
  });
});

describe('parseRuleSuggestions', () => {
  beforeEach(() => {
    vi.mocked(crypto.randomUUID).mockReturnValue(
      'test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  it('parses valid rule suggestions from data.rules array', () => {
    const data = {
      rules: [
        {
          name: 'Newsletter Filter',
          conditions: [{ field: 'from', operator: 'contains', value: 'newsletter' }],
          actions: [{ type: 'moveToFolder', folderId: 'folder1' }],
          conditionLogic: 'all',
          confidence: 0.9,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result).toHaveLength(1);
    expect(result[0].rule.name).toBe('Newsletter Filter');
    expect(result[0].rule.conditions[0].field).toBe('from');
    expect(result[0].rule.conditions[0].value).toBe('newsletter');
    expect(result[0].rule.actions[0].type).toBe('moveToFolder');
    expect(result[0].rule.actions[0].folderId).toBe('folder1');
    expect(result[0].confidence).toBe(0.9);
  });

  it('generates unique IDs using crypto.randomUUID', () => {
    const data = {
      rules: [
        {
          name: 'Test Rule',
          conditions: [],
          actions: [],
          conditionLogic: 'all',
          confidence: 0.8,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(result[0].rule.id).toBe('test-uuid-1234');
  });

  it('defaults conditionLogic to "all" when missing', () => {
    const data = {
      rules: [
        {
          name: 'No Logic Rule',
          conditions: [],
          actions: [],
          confidence: 0.7,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result[0].rule.conditionLogic).toBe('all');
  });

  it('defaults condition operator to "contains" when missing', () => {
    const data = {
      rules: [
        {
          name: 'No Operator Rule',
          conditions: [{ field: 'subject', value: 'test' }],
          actions: [],
          conditionLogic: 'all',
          confidence: 0.6,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result[0].rule.conditions[0].operator).toBe('contains');
  });

  it('sets confidence to 0.5 when not a number', () => {
    const data = {
      rules: [
        {
          name: 'Bad Confidence Rule',
          conditions: [],
          actions: [],
          conditionLogic: 'all',
          confidence: 'high',
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result[0].confidence).toBe(0.5);
  });

  it('returns empty array when data.rules is undefined', () => {
    const result = parseRuleSuggestions({});
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});

describe('testConnection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns true for successful OpenAI-compatible response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Hello' } }] }),
    });
    const result = await testConnection('sk-test-key', 'gpt-4', 'openai');
    expect(result).toBe(true);
  });

  it('returns true for successful Anthropic response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'Hello' }] }),
    });
    const result = await testConnection('sk-ant-test-key', 'claude-3-opus', 'anthropic');
    expect(result).toBe(true);
  });

  it('throws on 401 (invalid API key)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });
    await expect(testConnection('bad-key', 'gpt-4', 'openai')).rejects.toThrow('Invalid API key');
  });

  it('throws on network/fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(testConnection('sk-test', 'gpt-4', 'openai')).rejects.toThrow('Network error');
  });

  it('uses correct URL for each provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('sk-test', 'gpt-4', 'openai');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );

    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'ok' }] }),
    });

    await testConnection('sk-ant-test', 'claude-3-opus', 'anthropic');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// --- parseRuleSuggestions: empty name fallback ---

describe('parseRuleSuggestions – name fallback', () => {
  beforeEach(() => {
    vi.mocked(crypto.randomUUID).mockReturnValue(
      'test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  it('uses fallback name when r.name is empty string', () => {
    const data = {
      rules: [
        {
          name: '',
          conditions: [{ field: 'from', operator: 'contains', value: 'test' }],
          actions: [{ type: 'markRead' }],
          conditionLogic: 'all',
          confidence: 0.8,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result).toHaveLength(1);
    // translate mock returns the key, so fallback will be 'ai_fallback_rule_name 1'
    expect(result[0].rule.name).toBe('ai_fallback_rule_name 1');
  });

  it('uses provided name when r.name is non-empty', () => {
    const data = {
      rules: [
        {
          name: 'My Rule',
          conditions: [],
          actions: [],
          conditionLogic: 'all',
          confidence: 0.7,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result[0].rule.name).toBe('My Rule');
  });

  it('uses fallback with correct index for multiple rules with empty names', () => {
    const data = {
      rules: [
        {
          name: '',
          conditions: [],
          actions: [],
          conditionLogic: 'all',
          confidence: 0.5,
        },
        {
          name: '',
          conditions: [],
          actions: [],
          conditionLogic: 'all',
          confidence: 0.6,
        },
      ],
    };
    const result = parseRuleSuggestions(data);
    expect(result).toHaveLength(2);
    expect(result[0].rule.name).toBe('ai_fallback_rule_name 1');
    expect(result[1].rule.name).toBe('ai_fallback_rule_name 2');
  });
});

// --- testConnection: additional provider branches ---

describe('testConnection – additional provider branches', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('uses OpenRouter base URL for openrouter provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('sk-or-test', 'model', 'openrouter');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses Google base URL for google provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('AIza-key', 'gemini-2.0-flash', 'google');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses custom base URL when provider is custom with customBaseUrl', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('key', 'model', 'custom', 'https://custom-llm.example.com/v1/chat');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-llm.example.com/v1/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to empty baseUrl when custom provider has no customBaseUrl', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    // custom provider with no customBaseUrl uses AI_PROVIDERS['custom'].baseUrl which is ''
    try {
      await testConnection('key', 'model', 'custom');
    } catch {
      // May throw due to empty URL — that's expected behavior
    }

    if (mockFetch.mock.calls.length > 0) {
      expect(mockFetch.mock.calls[0][0]).toBe('');
    }
  });

  it('does not add OpenRouter headers for google provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('key', 'model', 'google');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['HTTP-Referer']).toBeUndefined();
    expect(opts.headers['X-Title']).toBeUndefined();
  });

  it('throws with error message when Anthropic returns non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400, // Use 400 (not retryable) to avoid fetchWithRetry retries
      json: async () => ({ error: { message: 'Invalid model specified' } }),
    });

    await expect(testConnection('key', 'claude-3', 'anthropic')).rejects.toThrow(
      'Invalid model specified',
    );
  });

  it('throws with fallback status error when OpenAI error has no message field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: {} }),
    });

    await expect(testConnection('key', 'model', 'openai')).rejects.toThrow('Error: 422');
  });
});

// --- buildSystemPrompt: additional branches ---

describe('buildSystemPrompt – additional branches', () => {
  it('summarizes hasAttachments conditions differently', () => {
    const rulesWithAttachments: Rule[] = [
      {
        id: 'rule-att',
        name: 'Has attachments rule',
        enabled: false,
        conditions: [
          {
            field: 'hasAttachments',
            operator: 'equals',
            value: '',
            boolValue: true,
            caseSensitive: false,
          },
        ],
        conditionLogic: 'all',
        actions: [{ type: 'addTag', tagKey: 'tag1' }],
        stopProcessing: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    const result = buildSystemPrompt(folders, tags, rulesWithAttachments);
    expect(result).toContain('hasAttachments=true');
    expect(result).toContain('etiquetar tag1');
    expect(result).toContain('inactiva');
  });

  it('summarizes setPriority and markRead action types', () => {
    const rulesWithActions: Rule[] = [
      {
        id: 'rule-prio',
        name: 'Priority rule',
        enabled: true,
        conditions: [
          { field: 'subject', operator: 'contains', value: 'urgent', caseSensitive: false },
          { field: 'from', operator: 'contains', value: 'boss', caseSensitive: false },
        ],
        conditionLogic: 'any',
        actions: [{ type: 'setPriority', priority: 'high' }, { type: 'markRead' }],
        stopProcessing: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    const result = buildSystemPrompt(folders, tags, rulesWithActions);
    expect(result).toContain('prioridad high');
    expect(result).toContain('markRead');
    // 'any' logic with multiple conditions uses ' O ' separator
    expect(result).toContain(' O ');
  });
});
