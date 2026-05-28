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
import { isAutoSubmitted, isMailingList, getOwnAddresses } from './message-utils';
import { renderTemplate } from '../lib/utils/template-engine';
import { getLocaleFromStorage } from '../lib/i18n';

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

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Template not found'));
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

  // ── Branch coverage: uncovered paths ────────────────────────────────

  describe('fullMessage null paths', () => {
    it('skips safety checks when fullMessage is null', async () => {
      await triggerAutoResponse(makeHeader() as any, null, 'tpl-1');

      // Safety checks should not be called
      expect(isAutoSubmitted).not.toHaveBeenCalled();
      expect(isMailingList).not.toHaveBeenCalled();
      // But compose should still proceed
      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });

    it('uses empty bodyText when fullMessage is null', async () => {
      await triggerAutoResponse(makeHeader() as any, null, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          original_body: '',
          original_body_snippet: '',
        }),
      );
    });
  });

  describe('account fallback paths', () => {
    it('falls back to accounts[0] when folder.accountId does not match', async () => {
      mockMessenger.accounts.list.mockResolvedValue([
        {
          id: 'other-acc',
          name: 'Other',
          identities: [{ name: 'Other Me', email: 'other@test.com' }],
        },
      ]);

      await triggerAutoResponse(
        makeHeader({ folder: { accountId: 'non-existent', name: 'Inbox', type: 'inbox' } }) as any,
        fullMessage,
        'tpl-1',
      );

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ my_name: 'Other Me', my_email: 'other@test.com' }),
      );
    });

    it('handles empty identities gracefully', async () => {
      mockMessenger.accounts.list.mockResolvedValue([
        { id: 'acc1', name: 'AccountName', identities: [] },
      ]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ my_name: 'AccountName', my_email: '' }),
      );
    });

    it('handles accounts.list error gracefully', async () => {
      mockMessenger.accounts.list.mockRejectedValue(new Error('accounts fail'));

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      // Should still proceed with empty name/email
      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ my_name: '', my_email: '' }),
      );
    });

    it('uses myEmail when recipients is empty', async () => {
      mockMessenger.accounts.list.mockResolvedValue([
        { id: 'acc1', name: 'Main', identities: [{ name: 'Me', email: 'me@test.com' }] },
      ]);

      await triggerAutoResponse(makeHeader({ recipients: [] }) as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ to: 'me@test.com' }),
      );
    });

    it('uses myEmail when recipients is undefined', async () => {
      mockMessenger.accounts.list.mockResolvedValue([
        { id: 'acc1', name: 'Main', identities: [{ name: 'Me', email: 'me@test.com' }] },
      ]);

      await triggerAutoResponse(makeHeader({ recipients: undefined }) as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ to: 'me@test.com' }),
      );
    });
  });

  describe('template format', () => {
    it('uses body property for HTML template (isPlainText: false)', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ isPlainText: false })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).toHaveBeenCalledWith(
        1,
        'replyToSender',
        expect.objectContaining({ isPlainText: false }),
      );
      // body (not plainTextBody) should be set
      const callArgs = mockMessenger.compose.beginReply.mock.calls[0] as any[];
      expect(callArgs[2]?.body).toBeDefined();
      expect(callArgs[2]?.plainTextBody).toBeUndefined();
    });
  });

  describe('notification', () => {
    it('uses draft notification key for draft sendMode', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: true,
      } as any);
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'draft' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.notifications.create).toHaveBeenCalled();
    });
  });

  // ── Additional branch coverage tests ──────────────────────────────

  describe('sendLater sendMode path', () => {
    it('calls sendMessage with sendLater and increments count', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'sendLater' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.sendMessage).toHaveBeenCalledWith(100, { mode: 'sendLater' });
      expect(mockMessenger.compose.saveMessage).not.toHaveBeenCalled();
      expect(mockMessenger.tabs.remove).not.toHaveBeenCalled();
      expect(incrementAutoResponseCount).toHaveBeenCalled();
    });

    it('logs activity entry with sendLater mode in details', async () => {
      vi.mocked(getTemplates).mockResolvedValue([
        makeTemplate({ sendMode: 'sendLater', name: 'Later Template' }),
      ]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'autoResponse',
          details: expect.stringContaining('sendLater'),
        }),
      );
    });
  });

  describe('notification key branches', () => {
    it('uses notif_auto_response_sent key for sendNow mode', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: true,
      } as any);
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'sendNow' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      // translate mock returns the key itself, so the message should be the sent key
      expect(mockMessenger.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^smm-auto-/),
        expect.objectContaining({
          message: 'notif_auto_response_sent',
        }),
      );
    });

    it('uses notif_auto_response_draft key for draft mode', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: true,
      } as any);
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'draft' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^smm-auto-/),
        expect.objectContaining({
          message: 'notif_auto_response_draft',
        }),
      );
    });

    it('uses notif_auto_response_sent key for sendLater mode', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: true,
      } as any);
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'sendLater' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.notifications.create).toHaveBeenCalledWith(
        expect.stringMatching(/^smm-auto-/),
        expect.objectContaining({
          message: 'notif_auto_response_sent',
        }),
      );
    });

    it('does not create notification when notifyOnAutoResponse is false', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: false,
      } as any);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('rate limit exceeded details', () => {
    it('includes all expected fields in the rate limit log entry', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(false);

      const header = makeHeader({ id: 42, subject: 'Important', author: 'Boss <boss@co.com>' });
      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          ruleId: '',
          ruleName: '',
          messageId: 42,
          subject: 'Important',
          from: 'Boss <boss@co.com>',
          actions: ['autoRespond'],
          type: 'error',
          details: 'Rate limit exceeded - auto-response skipped',
        }),
      );
      // Should not proceed to compose
      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
      expect(incrementAutoResponseCount).not.toHaveBeenCalled();
    });
  });

  describe('template not found details', () => {
    it('logs error with the missing templateId and does not proceed', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ id: 'other-id' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'missing-tpl');

      expect(logger.error).toHaveBeenCalledWith('Template not found: missing-tpl');
      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
      expect(incrementAutoResponseCount).not.toHaveBeenCalled();
      expect(appendActivityLog).not.toHaveBeenCalled();
    });
  });

  describe('folder edge cases', () => {
    it('proceeds when folder is undefined', async () => {
      const header = makeHeader({ folder: undefined });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      // folderType would be undefined, which does not match sent/drafts/trash
      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });

    it('proceeds when folder has no type property', async () => {
      const header = makeHeader({ folder: { accountId: 'acc1', name: 'Custom' } });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });

    it('proceeds when folder type is inbox', async () => {
      const header = makeHeader({
        folder: { accountId: 'acc1', name: 'Inbox', type: 'inbox' },
      });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });

    it('proceeds when folder type is archives', async () => {
      const header = makeHeader({
        folder: { accountId: 'acc1', name: 'Archives', type: 'archives' },
      });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });
  });

  describe('own address safety check', () => {
    it('logs debug message when sender is own address', async () => {
      vi.mocked(getOwnAddresses).mockResolvedValue(['sender@test.com']);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(logger.debug).toHaveBeenCalledWith('Skipping auto-response: message from own account');
      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });

    it('skips when sender email matches own address case-insensitively', async () => {
      const { extractEmail } = await import('../lib/utils/template-engine');
      vi.mocked(extractEmail).mockReturnValue('SENDER@TEST.COM');
      vi.mocked(getOwnAddresses).mockResolvedValue(['sender@test.com']);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(mockMessenger.compose.beginReply).not.toHaveBeenCalled();
    });
  });

  describe('switch default / unrecognized sendMode', () => {
    it('does not call sendMessage or saveMessage for unknown sendMode', async () => {
      vi.mocked(getTemplates).mockResolvedValue([makeTemplate({ sendMode: 'unknownMode' })]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      // The switch has no default, so neither send nor save is called
      expect(mockMessenger.compose.sendMessage).not.toHaveBeenCalled();
      expect(mockMessenger.compose.saveMessage).not.toHaveBeenCalled();
      // But incrementAutoResponseCount should still be called (it's after the switch)
      expect(incrementAutoResponseCount).toHaveBeenCalled();
    });
  });

  describe('error handling with non-Error thrown value', () => {
    it('uses String() for non-Error thrown values', async () => {
      mockMessenger.compose.beginReply.mockRejectedValueOnce('string error');

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          details: 'Error: string error',
        }),
      );
    });

    it('uses String() for numeric thrown value', async () => {
      mockMessenger.compose.beginReply.mockRejectedValueOnce(404);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          details: 'Error: 404',
        }),
      );
    });
  });

  describe('header with missing optional fields', () => {
    it('handles undefined author gracefully', async () => {
      const header = makeHeader({ author: undefined });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      // author fallback '' is passed to extractEmail/extractName and used in activity log
      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '',
        }),
      );
      // Compose should still proceed
      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });

    it('handles undefined subject gracefully', async () => {
      const header = makeHeader({ subject: undefined });

      await triggerAutoResponse(header as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          subject: '',
          originalSubject: '',
        }),
      );
    });
  });

  describe('accounts with empty list', () => {
    it('sets empty my_name and my_email when no accounts exist', async () => {
      mockMessenger.accounts.list.mockResolvedValue([]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ my_name: '', my_email: '' }),
      );
    });
  });

  describe('accounts with undefined identities', () => {
    it('handles undefined identities property gracefully', async () => {
      mockMessenger.accounts.list.mockResolvedValue([
        { id: 'acc1', name: 'NoIdentity', identities: undefined },
      ] as any);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ my_name: 'NoIdentity', my_email: '' }),
      );
    });
  });

  describe('activity log details for sendMode', () => {
    it('includes sendMode draft in activity log details', async () => {
      vi.mocked(getTemplates).mockResolvedValue([
        makeTemplate({ sendMode: 'draft', name: 'Draft Template' }),
      ]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Template: Draft Template, Mode: draft',
        }),
      );
    });

    it('includes sendMode sendNow in activity log details', async () => {
      vi.mocked(getTemplates).mockResolvedValue([
        makeTemplate({ sendMode: 'sendNow', name: 'Send Template' }),
      ]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Template: Send Template, Mode: sendNow',
        }),
      );
    });
  });

  describe('locale en branch for date/time formatting', () => {
    it('uses en-US locale strings when locale is en', async () => {
      vi.mocked(getLocaleFromStorage).mockResolvedValue('en');

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      // The date and time variables should be formatted with en-US locale
      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          date: expect.any(String),
          time: expect.any(String),
        }),
      );
      expect(mockMessenger.compose.beginReply).toHaveBeenCalled();
    });
  });

  describe('error catch block with missing header fields', () => {
    it('uses empty string fallback for subject in error log when subject is undefined', async () => {
      mockMessenger.compose.beginReply.mockRejectedValueOnce(new Error('fail'));

      await triggerAutoResponse(makeHeader({ subject: undefined }) as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          subject: '',
        }),
      );
    });

    it('uses empty string fallback for author in error log when author is undefined', async () => {
      mockMessenger.compose.beginReply.mockRejectedValueOnce(new Error('fail'));

      await triggerAutoResponse(makeHeader({ author: undefined }) as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          from: '',
        }),
      );
    });
  });

  describe('rate limit log with missing header fields', () => {
    it('uses empty string for subject when header.subject is undefined', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(false);

      await triggerAutoResponse(makeHeader({ subject: undefined }) as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          subject: '',
          details: 'Rate limit exceeded - auto-response skipped',
        }),
      );
    });

    it('uses empty string for from when header.author is undefined', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(false);

      await triggerAutoResponse(makeHeader({ author: undefined }) as any, fullMessage, 'tpl-1');

      expect(appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          from: '',
          details: 'Rate limit exceeded - auto-response skipped',
        }),
      );
    });
  });

  describe('account name fallback when identity name is empty', () => {
    it('falls back to empty string when both identity.name and account.name are falsy', async () => {
      mockMessenger.accounts.list.mockResolvedValue([
        { id: 'acc1', name: '', identities: [{ name: '', email: 'me@test.com' }] },
      ]);

      await triggerAutoResponse(makeHeader() as any, fullMessage, 'tpl-1');

      expect(renderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ my_name: '' }),
      );
    });
  });

  describe('notification with undefined subject', () => {
    it('passes empty string for subject in translate when subject is undefined', async () => {
      vi.mocked(getSettings).mockResolvedValue({
        autoResponseEnabled: true,
        maxAutoResponsesPerHour: 10,
        notifyOnAutoResponse: true,
      } as any);

      await triggerAutoResponse(makeHeader({ subject: undefined }) as any, fullMessage, 'tpl-1');

      expect(mockMessenger.notifications.create).toHaveBeenCalled();
    });
  });
});
