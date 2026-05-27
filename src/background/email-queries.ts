/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { extractBodyText } from './message-utils';
import { getLocaleFromStorage, translate } from '../lib/i18n';
import { logger } from '../lib/utils/logger';
import { getErrorMessage } from '../lib/utils/error';
import { MAX_EMAIL_SNIPPET_LENGTH } from '../lib/utils/constants';

/// <reference path="../lib/utils/messenger.d.ts" />

const SMM_ANALYZED_TAG = 'smm_analyzed';

export interface RecentEmail {
  from: string;
  subject: string;
  snippet: string;
  accountName: string;
}

export interface EmailHeader {
  id: number;
  from: string;
  subject: string;
  snippet: string;
  folderName: string;
  accountName: string;
  date: number;
}

export interface EmailHeadersResult {
  emails: EmailHeader[];
  total: number;
  totalAvailable?: number;
  skippedAnalyzed?: number;
  error?: string;
}

export async function getRecentEmails(maxCount: number = 50): Promise<RecentEmail[]> {
  try {
    const accounts = await messenger.accounts.list();
    if (accounts.length === 0) return [];

    const emails: RecentEmail[] = [];
    for (const account of accounts) {
      if (emails.length >= maxCount) break;
      const subFolders = await messenger.folders.getSubFolders(account.rootFolder.id);
      const inbox = subFolders.find((f: messenger.folders.MailFolder) => f.type === 'inbox');
      if (!inbox) continue;

      const queryResult = await messenger.messages.list(inbox.id);
      let page = queryResult;
      while (page && emails.length < maxCount) {
        for (const msg of page.messages) {
          if (emails.length >= maxCount) break;
          let snippet = '';
          try {
            const full = await messenger.messages.getFull(msg.id);
            const bodyText = extractBodyText(full);
            snippet = bodyText.substring(0, MAX_EMAIL_SNIPPET_LENGTH);
          } catch { /* continue without snippet */ }
          emails.push({
            from: msg.author || '',
            subject: msg.subject || '',
            snippet,
            accountName: account.name,
          });
        }
        if (page.id) {
          page = await messenger.messages.continueList(page.id);
        } else {
          break;
        }
      }
    }
    return emails;
  } catch (err) {
    logger.error('Error fetching recent emails', err);
    return [];
  }
}

export async function getAllEmailHeaders(opts: {
  limit?: number;
  accountId?: string;
  skipAnalyzed?: boolean;
}): Promise<EmailHeadersResult> {
  try {
    const limit = opts.limit || 500;
    const skipTypes = new Set(['trash', 'junk', 'drafts', 'sent', 'templates', 'outbox']);
    const skipAnalyzed = opts.skipAnalyzed === true;

    // Build account name lookup
    const allAccounts = await messenger.accounts.list();
    if (allAccounts.length === 0) return { emails: [], total: 0 };
    const accountNames: Record<string, string> = {};
    for (const acc of allAccounts) accountNames[acc.id] = acc.name;

    // Use messages.query for fast cross-folder search
    const queryInfo: Record<string, unknown> = {};
    if (opts.accountId) queryInfo.accountId = opts.accountId;

    const emails: EmailHeader[] = [];
    let skippedAnalyzed = 0;
    const collectTarget = Math.max(limit * 3, 300);

    let page = await messenger.messages.query(queryInfo);
    while (page && emails.length < collectTarget) {
      for (const msg of page.messages) {
        if (emails.length >= collectTarget) break;
        if (msg.folder?.type && skipTypes.has(msg.folder.type)) continue;
        if (skipAnalyzed && msg.tags?.includes(SMM_ANALYZED_TAG)) {
          skippedAnalyzed++;
          continue;
        }
        emails.push({
          id: msg.id,
          from: msg.author || '',
          subject: msg.subject || '',
          snippet: '',
          folderName: msg.folder?.name || '',
          accountName: accountNames[msg.folder?.accountId] || '',
          date: msg.date ? new Date(msg.date).getTime() : 0,
        });
      }
      if (page.id) {
        page = await messenger.messages.continueList(page.id);
      } else {
        break;
      }
    }

    // Sort newest first and apply limit
    emails.sort((a, b) => b.date - a.date);
    const limited = emails.slice(0, limit);

    return { emails: limited, total: limited.length, totalAvailable: emails.length, skippedAnalyzed };
  } catch (err: unknown) {
    logger.error('Error fetching all emails', err);
    return { emails: [], total: 0, error: getErrorMessage(err) };
  }
}

export async function markEmailsAnalyzed(messageIds: number[]): Promise<{ success: boolean; marked?: number; error?: string }> {
  try {
    // Ensure the tag exists
    const existingTags = await messenger.messages.tags.list();
    if (!existingTags.find((t: messenger.messages.MessageTag) => t.key === SMM_ANALYZED_TAG)) {
      const tagLoc = await getLocaleFromStorage();
      await messenger.messages.tags.create(SMM_ANALYZED_TAG, translate(tagLoc, 'tag_analyzed'), '#90CAF9');
    }

    let marked = 0;
    for (const msgId of messageIds) {
      try {
        const msg = await messenger.messages.get(msgId);
        if (!msg.tags?.includes(SMM_ANALYZED_TAG)) {
          await messenger.messages.update(msgId, {
            tags: [...(msg.tags || []), SMM_ANALYZED_TAG],
          });
          marked++;
        }
      } catch (e) { logger.debug(`Could not tag message ${msgId}`, e); }
    }
    return { success: true, marked };
  } catch (err: unknown) {
    logger.error('Error marking emails', err);
    return { success: false, error: getErrorMessage(err) };
  }
}
