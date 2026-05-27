/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/utils/storage', () => ({
  getSettings: vi.fn(),
  getTemplates: vi.fn(),
  checkRateLimit: vi.fn(),
  incrementAutoResponseCount: vi.fn(),
  appendActivityLog: vi.fn(),
}));

vi.mock('./message-utils', () => ({
  isAutoSubmitted: vi.fn(() => false),
  isMailingList: vi.fn(() => false),
  getOwnAddresses: vi.fn(() => []),
  extractBodyText: vi.fn(() => 'body text'),
}));

vi.mock('../lib/i18n', () => ({
  getLocaleFromStorage: vi.fn(async () => 'es'),
  translate: vi.fn((_loc: string, key: string) => key),
}));

vi.mock('../lib/utils/template-engine', () => ({
  renderTemplate: vi.fn((tmpl: string) => tmpl),
  extractName: vi.fn(() => 'Test Sender'),
  extractEmail: vi.fn(() => 'sender@test.com'),
}));

vi.mock('../lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockMessenger = {
  accounts: {
    list: vi.fn(async () => [
      {
        id: 'acc1',
        name: 'Main',
        identities: [{ name: 'Me', email: 'me@test.com' }],
      },
    ]),
  },
  compose: {
    beginReply: vi.fn(async () => ({ id: 100 })),
    sendMessage: vi.fn(async () => {}),
    saveMessage: vi.fn(async () => {}),
  },
  tabs: { remove: vi.fn(async () => {}) },
  notifications: { create: vi.fn(async () => 'notif-id') },
};
vi.stubGlobal('messenger', mockMessenger);

import { triggerAutoResponse } from './autoresponder';
import {
  getSettings,
  getTemplates,
  checkRateLimit,
  incrementAutoResponseCount,
  appendActivityLog,
} from '../lib/utils/storage';
import {
  isAutoSubmitted,
  isMailingList,
  getOwnAddresses,
} from './message-utils';
import { renderTemplate } from '../lib/utils/template-engine';

function makeHeader(overrides = {}) {
  return {
    id: 1,
    author: 'Test Sender <sender@test.com>',
    subject: 'Test Subject',
    recipients: ['user@example.com'],
    tags: [],
    folder: { accountId: 'acc1', name: 'Inbox', path: 'INBOX', type: 'inbox' },
    ...overrides,
  };
}

function makeTemplate(overrides = {}): any {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    subject: 'Re: {{subject}}',
    body: 'Hello {{sender_name}}',
    isPlainText: true,
    sendMode: 'sendNow',
    replyType: 'replyToSender',
    ...overrides,
  };
}

const fullMessage = { body: 'Original body', contentType: 'text/plain' } as any;

// Import logger for assertions
import { logger } from '../lib/utils/logger';

describe('triggerAutoResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Storage mocks
    vi.mocked(getSettings).mockResolvedValue({
      autoResponseEnabled: true,
      maxAutoResponsesPerHour: 10,
      notifyOnAutoResponse: false,
    } as any);
    vi.mocked(getTemplates).mockResolvedValue([makeTemplate()]);
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(incrementAutoResponseCount).mockResolvedValue(undefined);
    vi.mocked(appendActivityLog).mockResolvedValue(undefined);

    // Message-utils mocks — must reset because individual tests override these
    vi.mocked(isAutoSubmitted).mockReturnValue(false);
    vi.mocked(isMailingList).mockReturnValue(false);
    vi.mocked(getOwnAddresses).mockResolvedValue([]);

    // Messenger mocks — reset to default happy path
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Main', identities: [{ name: 'Me', email: 'me@test.com' }] },
    ]);
    mockMessenger.compose.beginReply.mockResolvedValue({ id: 100 });
    mockMessenger.compose.sendMessage.mockResolvedValue(undefined);
    mockMessenger.compose.saveMessage.mockResolvedValue(undefined);
    mockMessenger.tabs.remove.mockResolvedValue(undefined);
  });

  // ── Early exits ──────────────────────────────────────────────────────

  describe('early exits', () => {
    it('returns when autoResponseEnabled is false', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: false,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: false,
      } as any);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
      expect(appendActivityLog).not.toHaveBeenCalled();
    });

    it('returns when message is auto-submitted', async () => {
      vi.mocked(isAutoSubmitted).mockReturnValue(true);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('returns when message is from mailing list', async () => {
      vi.mocked(isMailingList).mockReturnValue(true);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('returns when sender is own address', async () => {
      vi.mocked(getOwnAddresses).mockResolvedValue(['sender@test.com']);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('returns when folder type is sent', async () => {
      const header = makeHeader({
        folder: { accountId: 'acc1', name: 'Sent', path: 'Sent', type: 'sent' },
      });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('returns when folder type is drafts', async () => {
      const header = makeHeader({
        folder: { accountId: 'acc1', name: 'Drafts', path: 'Drafts', type: 'drafts' },
      });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('returns when folder type is trash', async () => {
      const header = makeHeader({
        folder: { accountId: 'acc1', name: 'Trash', path: 'Trash', type: 'trash' },
      });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('logs error entry and returns when rate limit exceeded', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(false);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          details: 'Rate limit exceeded - auto-response skipped',
        }),
      );
      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('proceeds when under rate limit', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(true);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });
  });

  // ── Template resolution ──────────────────────────────────────────────

  describe('template', () => {
    it('returns and logs error when templateId not found', async () => {
      vi.mocked(getTemplates).mockResolvedValue([]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Template not found'),
      );
      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('uses correct template when found', async () => {
      const template = makeTemplate({ id: 'tpl-2', name: 'Second Template' });
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate(), template]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-2');

      expect(mockMessenger.compose.beginReply).toHaveBeenCalledWith(
        1,
        'replyToSender',
        expect.objectContaining({ isPlainText: true }),
      );
    });
  });

  // ── Compose flow ─────────────────────────────────────────────────────

  describe('compose flow', () => {
    it('sendMode draft: calls saveMessage and tabs.remove', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'draft' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.saveMessage).toHaveBeenCalledWith(100, { mode: 'draft' });
      expect(mockMessenger.tabs.remove).toHaveBeenCalledWith(100);
      expect(mockMessenger.compose.sendMessage).not.toHaveBeenCalled();
    });

    it('sendMode sendNow: calls sendMessage with mode sendNow', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'sendNow' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.sendMessage).toHaveBeenCalledWith(100, { mode: 'sendNow' });
      expect(mockMessenger.compose.saveMessage).not.toHaveBeenCalled();
    });

    it('sendMode sendLater: calls sendMessage with mode sendLater', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'sendLater' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.sendMessage).toHaveBeenCalledWith(100, { mode: 'sendLater' });
      expect(mockMessenger.compose.saveMessage).not.toHaveBeenCalled();
    });
  });

  // ── Post-send behaviour ──────────────────────────────────────────────

  describe('post-send', () => {
    it('calls incrementAutoResponseCount after send', async () => {
      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(incrementAutoResponseCount).toHaveBeenCalled();
    });

    it('logs activity entry with type autoResponse', async () => {
      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'autoResponse',
          messageId: 1,
          subject: 'Test Subject',
          from: 'Test Sender <sender@test.com>',
          actions: ['autoRespond'],
          ruleName: 'Test Template',
          details: expect.stringContaining('Test Template'),
        }),
      );
    });

    it('creates notification when notifyOnAutoResponse is true', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: true,
      } as any);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^smm-auto-/),
        expect.objectContaining({
          type: 'basic',
          title: 'Smart Mail Manager',
        }),
      );
    });
  });

  // ── Error handling ───────────────────────────────────────────────────

  describe('error handling', () => {
    it('catches compose errors and logs error entry with type error', async () => {
      mockMessenger.compose.beginReply.mockRejectedValueOnce(new Error('Compose failed'));

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          actions: ['autoRespond'],
        }),
      );
    });

    it('error log includes error message', async () => {
      mockMessenger.compose.beginReply.mockRejectedValueOnce(new Error('Network timeout'));

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          details: expect.stringContaining('Network timeout'),
        }),
      );
    });
  });

  // ── Template variables ───────────────────────────────────────────────

  describe('template variables', () => {
    it('calls renderTemplate with expected variables', async () => {
      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        'Re: {{subject}}',
        expect.objectContaining({
          sender_name: 'Test Sender',
          sender_email: 'sender@test.com',
          subject: 'Test Subject',
          senderName: 'Test Sender',
          senderEmail: 'sender@test.com',
          originalSubject: 'Test Subject',
          my_name: 'Me',
          my_email: 'me@test.com',
          to: 'user@example.com',
          original_body: 'body text',
        }),
      );

      expect(renderTemplate).toHaveBeenCalledWith(
        'Hello {{sender_name}}',
        expect.objectContaining({
          sender_name: 'Test Sender',
          sender_email: 'sender@test.com',
        }),
      );
    });
  });
});
