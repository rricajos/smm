/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  OPENAI_MODELS,
  OPENAI_DIRECT_MODELS,
  ANTHROPIC_DIRECT_MODELS,
  GOOGLE_DIRECT_MODELS,
  AI_PROVIDERS,
  TEMPLATE_VARIABLES,
  MAX_ACTIVITY_LOG_ENTRIES,
  MAX_EMAIL_SNIPPET_LENGTH,
  MAX_SANITIZED_CONTENT_LENGTH,
  MAX_CHAT_EMAILS,
  REGEX_MAX_INPUT_LENGTH,
} from './constants';

describe('STORAGE_KEYS', () => {
  it('all keys have the smm_ prefix', () => {
    for (const value of Object.values(STORAGE_KEYS)) {
      expect(value).toMatch(/^smm_/);
    }
  });

  it('has all required keys', () => {
    const required = [
      'RULES',
      'TEMPLATES',
      'SETTINGS',
      'ACTIVITY_LOG',
      'AUTO_RESPONSE_COUNT',
      'CHAT_HISTORY',
      'LOCALE',
    ];
    for (const key of required) {
      expect(STORAGE_KEYS).toHaveProperty(key);
    }
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has valid default values', () => {
    expect(DEFAULT_SETTINGS.classificationEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.autoResponseEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.maxAutoResponsesPerHour).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.logRetentionDays).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.openaiApiKey).toBe('');
    expect(DEFAULT_SETTINGS.aiConsentAccepted).toBe(false);
  });

  it('aiProvider is a valid provider key', () => {
    expect(Object.keys(AI_PROVIDERS)).toContain(DEFAULT_SETTINGS.aiProvider);
  });
});

describe('Model arrays', () => {
  it('OPENAI_MODELS is non-empty with required fields', () => {
    expect(OPENAI_MODELS.length).toBeGreaterThan(0);
    for (const model of OPENAI_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
      expect(model.provider).toBeTruthy();
    }
  });

  it('OPENAI_DIRECT_MODELS is non-empty with required fields', () => {
    expect(OPENAI_DIRECT_MODELS.length).toBeGreaterThan(0);
    for (const model of OPENAI_DIRECT_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
    }
  });

  it('ANTHROPIC_DIRECT_MODELS is non-empty with required fields', () => {
    expect(ANTHROPIC_DIRECT_MODELS.length).toBeGreaterThan(0);
    for (const model of ANTHROPIC_DIRECT_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
    }
  });

  it('GOOGLE_DIRECT_MODELS is non-empty with required fields', () => {
    expect(GOOGLE_DIRECT_MODELS.length).toBeGreaterThan(0);
    for (const model of GOOGLE_DIRECT_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
    }
  });
});

describe('AI_PROVIDERS', () => {
  it('each provider has name, baseUrl, format', () => {
    for (const [key, provider] of Object.entries(AI_PROVIDERS)) {
      expect(provider.name).toBeTruthy();
      expect(typeof provider.baseUrl).toBe('string');
      expect(['openai', 'anthropic']).toContain(provider.format);
      expect(provider.keyPlaceholder).toBeTruthy();
      expect(provider.keyHintKey).toBeTruthy();
      // custom has empty baseUrl, others should have urls
      if (key !== 'custom') {
        expect(provider.baseUrl).toMatch(/^https:\/\//);
      }
    }
  });
});

describe('TEMPLATE_VARIABLES', () => {
  it('is non-empty with key, label, example', () => {
    expect(TEMPLATE_VARIABLES.length).toBeGreaterThan(0);
    for (const v of TEMPLATE_VARIABLES) {
      expect(v.key).toBeTruthy();
      expect(v.label).toBeTruthy();
      expect(v.example).toBeTruthy();
    }
  });
});

describe('Numeric constants', () => {
  it('are all positive numbers', () => {
    expect(MAX_ACTIVITY_LOG_ENTRIES).toBeGreaterThan(0);
    expect(MAX_EMAIL_SNIPPET_LENGTH).toBeGreaterThan(0);
    expect(MAX_SANITIZED_CONTENT_LENGTH).toBeGreaterThan(0);
    expect(MAX_CHAT_EMAILS).toBeGreaterThan(0);
    expect(REGEX_MAX_INPUT_LENGTH).toBeGreaterThan(0);
  });
});
