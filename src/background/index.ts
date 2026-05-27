/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { classifyMessage, executeActions } from './classifier';
import { triggerAutoResponse } from './autoresponder';
import { getSettings, cleanupOldActivityEntries } from '../lib/utils/storage';
import { getLocaleFromStorage, translate } from '../lib/i18n';
import { getAllFolders } from './message-utils';
import { logger } from '../lib/utils/logger';
import { createFolder, deleteFolder, renameFolder, moveFolderContents, getFolderTree } from './folder-ops';
import { getRecentEmails, getAllEmailHeaders, markEmailsAnalyzed } from './email-queries';
import { testRule, processExisting, testSingleRule } from './rule-testing';
import type { Settings } from '../types/settings';
import type { Rule } from '../types/rules';

/// <reference path="../lib/utils/messenger.d.ts" />

type BackgroundMessage =
  | { type: 'CLASSIFY_MESSAGE'; messageId: number }
  | { type: 'GET_FOLDERS' }
  | { type: 'GET_TAGS' }
  | { type: 'GET_DISPLAYED_MESSAGE' }
  | { type: 'TEST_RULE'; messageId: number; ruleId: string }
  | { type: 'GET_RECENT_EMAILS' }
  | { type: 'GET_FOLDERS_AND_TAGS' }
  | { type: 'GET_ACCOUNT_INFO' }
  | { type: 'PROCESS_EXISTING'; limit?: number }
  | { type: 'TEST_SINGLE_RULE'; rule: Rule; limit?: number }
  | { type: 'CREATE_FOLDER'; parentFolderId: string; folderName: string }
  | { type: 'DELETE_FOLDER'; folderId: string }
  | { type: 'GET_FOLDER_TREE' }
  | { type: 'GET_ALL_EMAILS_HEADERS'; limit?: number; accountId?: string; skipAnalyzed?: boolean }
  | { type: 'RENAME_FOLDER'; folderId: string; newName: string }
  | { type: 'MARK_EMAILS_ANALYZED'; messageIds?: number[] }
  | { type: 'MOVE_FOLDER_CONTENTS'; sourceFolderId: string; destFolderId: string; deleteSource?: boolean }
  | { type: 'OPEN_SPACE' };

const SMM_ANALYZED_TAG = 'smm_analyzed';

logger.info('Smart Mail Manager background script loaded');

// Register custom space in the spaces toolbar
messenger.spacesToolbar.addButton('smartMailManager', {
  title: 'Smart Mail Manager',
  url: '/space.html',
  defaultIcons: {
    16: '/icons/icon-16.svg',
    32: '/icons/icon-32.svg',
  },
});

// Startup initialization: cleanup old logs + ensure custom tag exists
(async () => {
  try {
    const s = await getSettings();
    if (s.logRetentionDays > 0) {
      const removed = await cleanupOldActivityEntries(s.logRetentionDays);
      if (removed > 0) logger.debug(`Log cleanup: removed ${removed} old entries`);
    }
  } catch (err) {
    logger.error('Error during log cleanup', err);
  }

  // Ensure the "Analyzed" tag exists so it shows up in Thunderbird settings
  try {
    const existingTags = await messenger.messages.tags.list();
    const found = existingTags.find((t: messenger.messages.MessageTag) => t.key === SMM_ANALYZED_TAG);
    if (!found) {
      const tagLoc = await getLocaleFromStorage();
      await messenger.messages.tags.create(SMM_ANALYZED_TAG, translate(tagLoc, 'tag_analyzed'), '#90CAF9');
      logger.debug('Created analyzed tag');
    }
  } catch (err) {
    logger.error('Error creating analyzed tag', err);
  }
})();

setInterval(async () => {
  try {
    const s = await getSettings();
    if (s.logRetentionDays > 0) {
      await cleanupOldActivityEntries(s.logRetentionDays);
    }
  } catch (err) { logger.error('Periodic log cleanup failed', err); }
}, 6 * 60 * 60 * 1000);

// Listen for new mail (all accounts)
messenger.messages.onNewMailReceived.addListener(
  async (_folder: messenger.folders.MailFolder, messages: messenger.messages.MessageList) => {
    const settings = await getSettings();
    if (!settings.classificationEnabled) return;

    for (const msg of messages.messages) {
      await processMessage(msg, settings);
    }
  },
);

async function processMessage(header: messenger.messages.MessageHeader, settings: Settings): Promise<void> {
  try {
    let fullMessage: messenger.messages.MessagePart | null = null;

    // Only fetch full message if needed (some rules check body)
    const results = await classifyMessage(header, fullMessage);

    if (results.length > 0) {
      await executeActions(header, results);

      // Increment unread classification counter for badge
      try {
        const countResult = await messenger.storage.local.get('smm_unread_classifications');
        const current = (countResult['smm_unread_classifications'] as number) || 0;
        await messenger.storage.local.set({ 'smm_unread_classifications': current + 1 });
      } catch (err) { logger.error('Badge counter update failed', err); }

      // Handle auto-respond actions
      for (const { rule } of results) {
        for (const action of rule.actions) {
          if (action.type === 'autoRespond' && action.templateId) {
            if (!fullMessage) {
              try {
                fullMessage = await messenger.messages.getFull(header.id);
              } catch (err) {
                logger.warn('Could not fetch full message for auto-respond', err);
              }
            }
            await triggerAutoResponse(header, fullMessage, action.templateId);
          }
        }
      }

      if (settings.notifyOnClassification) {
        const loc = await getLocaleFromStorage();
        messenger.notifications.create(`smm-classify-${Date.now()}`, {
          type: 'basic',
          title: 'Smart Mail Manager',
          message: translate(loc, 'notif_classified', { subject: header.subject, n: results.length, s: results.length > 1 ? 's' : '' }),
        });
      }
    }
  } catch (err) {
    logger.error('Error processing message', err);
  }
}

// Handle messages from UI
messenger.runtime.onMessage.addListener(
  async (msg: unknown, _sender: unknown) => {
    const message = msg as BackgroundMessage;
    switch (message.type) {
      case 'CLASSIFY_MESSAGE': {
        const header = await messenger.messages.get(message.messageId);
        const settings = await getSettings();
        await processMessage(header, settings);
        return { success: true };
      }

      case 'GET_FOLDERS':
        return getAllFolders();

      case 'GET_TAGS': {
        try {
          return await messenger.messages.tags.list();
        } catch (err) {
          logger.error('Failed to list tags', err);
          return [];
        }
      }

      case 'GET_DISPLAYED_MESSAGE': {
        try {
          const tabs = await messenger.tabs.query({ active: true, currentWindow: true });
          if (tabs.length > 0) {
            const messages = await messenger.messageDisplay.getDisplayedMessages(tabs[0].id);
            return messages.length > 0 ? messages[0] : null;
          }
        } catch (err) {
          logger.error('Failed to get displayed message', err);
          return null;
        }
        return null;
      }

      case 'TEST_RULE':
        return testRule(message.messageId, message.ruleId);

      case 'GET_RECENT_EMAILS':
        return getRecentEmails();

      case 'GET_FOLDERS_AND_TAGS': {
        const allFolders = await getAllFolders();
        const folderInfos = allFolders.map((f) => ({
          id: f.id || `${f.accountId}:/${f.path}`,
          name: f.name,
          path: f.accountName ? `${f.accountName}/${f.path}` : f.path,
        }));
        let tags: messenger.messages.MessageTag[] = [];
        try {
          tags = await messenger.messages.tags.list();
        } catch { /* fallback to empty */ }
        return { folders: folderInfos, tags };
      }

      case 'GET_ACCOUNT_INFO': {
        try {
          const accounts = await messenger.accounts.list();
          if (accounts.length === 0) return [];
          return accounts.map((account: messenger.accounts.MailAccount) => ({
            name: account.identities?.[0]?.name || account.name || '',
            email: account.identities?.[0]?.email || '',
            accountId: account.id,
          }));
        } catch {
          return [];
        }
      }

      case 'PROCESS_EXISTING':
        return processExisting(message.limit || 50);

      case 'TEST_SINGLE_RULE':
        return testSingleRule(message.rule, message.limit || 50);

      case 'CREATE_FOLDER':
        return createFolder(message.parentFolderId, message.folderName);

      case 'DELETE_FOLDER':
        return deleteFolder(message.folderId);

      case 'GET_FOLDER_TREE':
        return getFolderTree();

      case 'GET_ALL_EMAILS_HEADERS':
        return getAllEmailHeaders({
          limit: message.limit,
          accountId: message.accountId,
          skipAnalyzed: message.skipAnalyzed,
        });

      case 'RENAME_FOLDER':
        return renameFolder(message.folderId, message.newName);

      case 'MARK_EMAILS_ANALYZED':
        return markEmailsAnalyzed(message.messageIds || []);

      case 'MOVE_FOLDER_CONTENTS':
        return moveFolderContents(message.sourceFolderId, message.destFolderId, message.deleteSource ?? false);

      case 'OPEN_SPACE': {
        try {
          await messenger.spacesToolbar.clickButton('smartMailManager');
          return { success: true };
        } catch {
          return { success: false };
        }
      }

      default:
        return { error: 'Unknown message type' };
    }
  },
);
