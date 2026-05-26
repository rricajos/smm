/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { classifyMessage, executeActions, clearMessageCache } from './classifier';
import { triggerAutoResponse } from './autoresponder';
import { getSettings, cleanupOldActivityEntries } from '../lib/utils/storage';
import { getLocaleFromStorage, translate } from '../lib/i18n';
import { getAllFolders, extractBodyText } from './message-utils';

declare const messenger: any;

const SMM_ANALYZED_TAG = 'smm_analyzed';

console.log('[SMM] Smart Mail Manager background script loaded');

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
      if (removed > 0) console.debug(`[SMM] Log cleanup: removed ${removed} old entries`);
    }
  } catch (err) {
    console.error('[SMM] Error during log cleanup:', err);
  }

  // Ensure the "Analyzed" tag exists so it shows up in Thunderbird settings
  try {
    const existingTags = await messenger.messages.tags.list();
    const found = existingTags.find((t: any) => t.key === SMM_ANALYZED_TAG);
    if (!found) {
      const tagLoc = await getLocaleFromStorage();
      await messenger.messages.tags.create(SMM_ANALYZED_TAG, translate(tagLoc, 'tag_analyzed'), '#90CAF9');
      console.debug('[SMM] Created analyzed tag');
    }
  } catch (err) {
    console.error('[SMM] Error creating analyzed tag:', err);
  }
})();

setInterval(async () => {
  try {
    const s = await getSettings();
    if (s.logRetentionDays > 0) {
      await cleanupOldActivityEntries(s.logRetentionDays);
    }
  } catch { /* ignore */ }
}, 6 * 60 * 60 * 1000);

// Listen for new mail (all accounts)
messenger.messages.onNewMailReceived.addListener(
  async (_folder: any, messages: any) => {
    const settings = await getSettings();
    if (!settings.classificationEnabled) return;

    for (const msg of messages.messages) {
      await processMessage(msg, settings);
    }
  },
);

async function processMessage(header: any, settings: any): Promise<void> {
  try {
    let fullMessage: any = null;

    // Only fetch full message if needed (some rules check body)
    const results = await classifyMessage(header, fullMessage);

    if (results.length > 0) {
      await executeActions(header, results);

      // Increment unread classification counter for badge
      try {
        const countResult = await messenger.storage.local.get('smm_unread_classifications');
        const current = countResult['smm_unread_classifications'] || 0;
        await messenger.storage.local.set({ 'smm_unread_classifications': current + 1 });
      } catch { /* ignore */ }

      // Handle auto-respond actions
      for (const { rule } of results) {
        for (const action of rule.actions) {
          if (action.type === 'autoRespond' && action.templateId) {
            if (!fullMessage) {
              try {
                fullMessage = await messenger.messages.getFull(header.id);
              } catch {
                // Continue without full message
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
    console.error('[SMM] Error processing message:', err);
  }
}

// Handle messages from UI
messenger.runtime.onMessage.addListener(
  async (message: any, _sender: any) => {
    switch (message.type) {
      case 'CLASSIFY_MESSAGE': {
        const header = await messenger.messages.get(message.messageId);
        const settings = await getSettings();
        await processMessage(header, settings);
        return { success: true };
      }

      case 'GET_FOLDERS': {
        const folders = await getAllFolders();
        return folders;
      }

      case 'GET_TAGS': {
        try {
          return await messenger.messages.tags.list();
        } catch {
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
        } catch {
          return null;
        }
        return null;
      }

      case 'TEST_RULE': {
        const header = await messenger.messages.get(message.messageId);
        let fullMessage = null;
        try {
          fullMessage = await messenger.messages.getFull(message.messageId);
        } catch { /* continue */ }
        const results = await classifyMessage(header, fullMessage);
        return {
          matched: results.some((r) => r.rule.id === message.ruleId),
          results: results.map((r) => r.rule.name),
        };
      }

      case 'GET_RECENT_EMAILS': {
        try {
          const accounts = await messenger.accounts.list();
          if (accounts.length === 0) return [];

          const emails: any[] = [];
          for (const account of accounts) {
            if (emails.length >= 50) break;
            const subFolders = await messenger.folders.getSubFolders(account.rootFolder.id);
            const inbox = subFolders.find((f: any) => f.type === 'inbox');
            if (!inbox) continue;

            const queryResult = await messenger.messages.list(inbox.id);
            let page = queryResult;
            while (page && emails.length < 50) {
              for (const msg of page.messages) {
                if (emails.length >= 50) break;
                let snippet = '';
                try {
                  const full = await messenger.messages.getFull(msg.id);
                  const bodyText = extractBodyText(full);
                  snippet = bodyText.substring(0, 150);
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
          console.error('[SMM] Error fetching recent emails:', err);
          return [];
        }
      }

      case 'GET_FOLDERS_AND_TAGS': {
        const allFolders = await getAllFolders();
        const folderInfos = allFolders.map((f: any) => ({
          id: f.id || `${f.accountId}:/${f.path}`,
          name: f.name,
          path: f.accountName ? `${f.accountName}/${f.path}` : f.path,
        }));
        let tags: any[] = [];
        try {
          tags = await messenger.messages.tags.list();
        } catch { /* fallback to empty */ }
        return { folders: folderInfos, tags };
      }

      case 'GET_ACCOUNT_INFO': {
        try {
          const accounts = await messenger.accounts.list();
          if (accounts.length === 0) return [];
          return accounts.map((account: any) => ({
            name: account.identities?.[0]?.name || account.name || '',
            email: account.identities?.[0]?.email || '',
            accountId: account.id,
          }));
        } catch {
          return [];
        }
      }

      case 'PROCESS_EXISTING': {
        try {
          const accounts = await messenger.accounts.list();
          if (accounts.length === 0) return { processed: 0, matched: 0, errors: 0 };

          const limit = message.limit || 50;
          const settings = await getSettings();
          let processed = 0;
          let matched = 0;
          let errors = 0;
          const details: Array<{ subject: string; from: string; rules: string[] }> = [];

          for (const account of accounts) {
            if (processed >= limit) break;
            const subFolders = await messenger.folders.getSubFolders(account.rootFolder.id);
            const inbox = subFolders.find((f: any) => f.type === 'inbox');
            if (!inbox) continue;

            const queryResult = await messenger.messages.list(inbox.id);
            let page = queryResult;

            while (page && processed < limit) {
              for (const msg of page.messages) {
                if (processed >= limit) break;
                processed++;
                try {
                  const results = await classifyMessage(msg, null);
                  if (results.length > 0) {
                    await executeActions(msg, results);
                    matched++;
                    details.push({
                      subject: msg.subject || '',
                      from: msg.author || '',
                      rules: results.map((r) => r.rule.name),
                    });
                  }
                } catch {
                  errors++;
                }
              }
              if (page.id && processed < limit) {
                page = await messenger.messages.continueList(page.id);
              } else {
                break;
              }
            }
          }

          clearMessageCache();
          return { processed, matched, errors, details };
        } catch (err: any) {
          console.error('[SMM] Error processing existing:', err);
          clearMessageCache();
          return { processed: 0, matched: 0, errors: 0, error: err?.message };
        }
      }

      case 'TEST_SINGLE_RULE': {
        try {
          const accounts = await messenger.accounts.list();
          if (accounts.length === 0) return { processed: 0, matched: 0, details: [] };

          const testRule = message.rule;
          const limit = message.limit || 50;
          let processed = 0;
          const details: Array<{ subject: string; from: string }> = [];

          // Temporarily save only this rule to test against
          const { getRules, saveRules } = await import('../lib/utils/storage');
          const originalRules = await getRules();
          await saveRules([{ ...testRule, enabled: true }]);

          try {
            for (const account of accounts) {
              if (processed >= limit) break;
              const subFolders = await messenger.folders.getSubFolders(account.rootFolder.id);
              const inbox = subFolders.find((f: any) => f.type === 'inbox');
              if (!inbox) continue;

              const queryResult = await messenger.messages.list(inbox.id);
              let page = queryResult;

              while (page && processed < limit) {
                for (const msg of page.messages) {
                  if (processed >= limit) break;
                  processed++;
                  try {
                    const results = await classifyMessage(msg, null);
                    if (results.length > 0) {
                      details.push({
                        subject: msg.subject || '',
                        from: msg.author || '',
                      });
                    }
                  } catch { /* skip */ }
                }
                if (page.id && processed < limit) {
                  page = await messenger.messages.continueList(page.id);
                } else {
                  break;
                }
              }
            }
          } finally {
            // Restore original rules
            await saveRules(originalRules);
          }

          clearMessageCache();
          return { processed, matched: details.length, details };
        } catch (err: any) {
          console.error('[SMM] Error testing rule:', err);
          clearMessageCache();
          return { processed: 0, matched: 0, details: [], error: err?.message };
        }
      }

      case 'CREATE_FOLDER': {
        try {
          // folders.create accepts a MailFolderId (string) directly in TB 128+
          const created = await messenger.folders.create(message.parentFolderId, message.folderName);
          return {
            success: true,
            folder: {
              id: created.id || `${created.accountId}:/${created.path}`,
              name: created.name,
              path: created.path,
            },
          };
        } catch (err: any) {
          console.error('[SMM] Error creating folder:', err);
          const cfLoc = await getLocaleFromStorage();
          return { success: false, error: err?.message || translate(cfLoc, 'bg_error_create_folder') };
        }
      }

      case 'DELETE_FOLDER': {
        try {
          await messenger.folders.delete(message.folderId);
          return { success: true };
        } catch (err: any) {
          console.error('[SMM] Error deleting folder:', err);
          const dfLoc = await getLocaleFromStorage();
          return { success: false, error: err?.message || translate(dfLoc, 'bg_error_create_folder') };
        }
      }

      case 'GET_FOLDER_TREE': {
        try {
          const accounts = await messenger.accounts.list();
          if (accounts.length === 0) return [];

          async function buildTree(folderId: string): Promise<any[]> {
            const subFolders = await messenger.folders.getSubFolders(folderId);
            const nodes: any[] = [];
            for (const f of subFolders) {
              let totalMessages = 0;
              let unreadMessages = 0;
              try {
                const info = await messenger.folders.getFolderInfo(f.id);
                totalMessages = info.totalMessageCount || 0;
                unreadMessages = info.unreadMessageCount || 0;
              } catch {
                totalMessages = f.totalMessageCount || 0;
                unreadMessages = f.unreadMessageCount || 0;
              }
              const children = await buildTree(f.id);
              nodes.push({
                id: f.id || `${f.accountId}:/${f.path}`,
                name: f.name,
                path: f.path,
                type: f.type || 'normal',
                totalMessages,
                unreadMessages,
                children,
              });
            }
            return nodes;
          }

          const trees = [];
          for (const account of accounts) {
            trees.push({
              accountName: account.name,
              accountId: account.id,
              folders: await buildTree(account.rootFolder.id),
            });
          }
          return trees;
        } catch (err: any) {
          console.error('[SMM] Error building folder tree:', err);
          return [];
        }
      }

      case 'GET_ALL_EMAILS_HEADERS': {
        try {
          const limit = message.limit || 500;
          const skipTypes = new Set(['trash', 'junk', 'drafts', 'sent', 'templates', 'outbox']);
          const skipAnalyzed = message.skipAnalyzed === true;

          // Build account name lookup
          const allAccounts = await messenger.accounts.list();
          if (allAccounts.length === 0) return { emails: [], total: 0 };
          const accountNames: Record<string, string> = {};
          for (const acc of allAccounts) accountNames[acc.id] = acc.name;

          // Use messages.query for fast cross-folder search (no recursive traversal)
          const queryInfo: any = {};
          if (message.accountId) queryInfo.accountId = message.accountId;

          const emails: Array<{ id: number; from: string; subject: string; snippet: string; folderName: string; accountName: string; date: number }> = [];
          let skippedAnalyzed = 0;
          // Overfetch to have buffer after filtering system folders + analyzed
          const collectTarget = Math.max(limit * 3, 300);

          let page = await messenger.messages.query(queryInfo);
          while (page && emails.length < collectTarget) {
            for (const msg of page.messages) {
              if (emails.length >= collectTarget) break;
              if (msg.folder && skipTypes.has(msg.folder.type)) continue;
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
        } catch (err: any) {
          console.error('[SMM] Error fetching all emails:', err);
          return { emails: [], total: 0, error: err?.message };
        }
      }

      case 'RENAME_FOLDER': {
        try {
          const renamed = await messenger.folders.rename(message.folderId, message.newName);
          return {
            success: true,
            folder: {
              id: renamed.id || `${renamed.accountId}:/${renamed.path}`,
              name: renamed.name,
              path: renamed.path,
            },
          };
        } catch (err: any) {
          console.error('[SMM] Error renaming folder:', err);
          const rfLoc = await getLocaleFromStorage();
          return { success: false, error: err?.message || translate(rfLoc, 'bg_error_rename_folder') };
        }
      }

      case 'MARK_EMAILS_ANALYZED': {
        try {
          // Ensure the tag exists
          const existingTags = await messenger.messages.tags.list();
          if (!existingTags.find((t: any) => t.key === SMM_ANALYZED_TAG)) {
            const tagLoc = await getLocaleFromStorage();
      await messenger.messages.tags.create(SMM_ANALYZED_TAG, translate(tagLoc, 'tag_analyzed'), '#90CAF9');
          }

          let marked = 0;
          for (const msgId of (message.messageIds || [])) {
            try {
              const msg = await messenger.messages.get(msgId);
              if (!msg.tags?.includes(SMM_ANALYZED_TAG)) {
                await messenger.messages.update(msgId, {
                  tags: [...(msg.tags || []), SMM_ANALYZED_TAG],
                });
                marked++;
              }
            } catch { /* skip individual failures */ }
          }
          return { success: true, marked };
        } catch (err: any) {
          console.error('[SMM] Error marking emails:', err);
          return { success: false, error: err?.message };
        }
      }

      case 'MOVE_FOLDER_CONTENTS': {
        try {
          const { sourceFolderId, destFolderId, deleteSource } = message;
          if (!sourceFolderId || !destFolderId) {
            return { success: false, error: 'sourceFolderId and destFolderId required' };
          }

          // Collect all message IDs from source folder
          const msgIds: number[] = [];
          let page = await messenger.messages.list(sourceFolderId);
          while (page) {
            for (const msg of page.messages) {
              msgIds.push(msg.id);
            }
            if (page.id) {
              page = await messenger.messages.continueList(page.id);
            } else {
              break;
            }
          }

          // Move all messages to destination
          if (msgIds.length > 0) {
            await messenger.messages.move(msgIds, destFolderId);
          }

          // Optionally delete the now-empty source folder
          if (deleteSource) {
            try {
              await messenger.folders.delete(sourceFolderId);
            } catch (delErr: any) {
              // Folder might not be empty if move was partial — log but don't fail
              console.error('[SMM] Could not delete source folder:', delErr);
            }
          }

          return { success: true, movedCount: msgIds.length };
        } catch (err: any) {
          console.error('[SMM] Error moving folder contents:', err);
          return { success: false, error: err?.message || 'Error moving emails' };
        }
      }

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
