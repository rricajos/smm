/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { getLocaleFromStorage, translate } from '../lib/i18n';
import { logger } from '../lib/utils/logger';
import { getErrorMessage } from '../lib/utils/error';

/// <reference path="../lib/utils/messenger.d.ts" />

export interface FolderResult {
  success: boolean;
  folder?: { id: string; name: string; path: string };
  error?: string;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  type: string;
  totalMessages: number;
  unreadMessages: number;
  children: FolderTreeNode[];
}

export interface AccountTree {
  accountName: string;
  accountId: string;
  folders: FolderTreeNode[];
}

export async function createFolder(parentFolderId: string, folderName: string): Promise<FolderResult> {
  try {
    const created = await messenger.folders.create(parentFolderId, folderName);
    return {
      success: true,
      folder: {
        id: created.id || `${created.accountId}:/${created.path}`,
        name: created.name,
        path: created.path,
      },
    };
  } catch (err: unknown) {
    logger.error('Error creating folder', err);
    const loc = await getLocaleFromStorage();
    return { success: false, error: getErrorMessage(err) || translate(loc, 'bg_error_create_folder') };
  }
}

export async function deleteFolder(folderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // @ts-expect-error 'delete' is a reserved word in TS but valid Thunderbird API
    await messenger.folders.delete(folderId);
    return { success: true };
  } catch (err: unknown) {
    logger.error('Error deleting folder', err);
    const loc = await getLocaleFromStorage();
    return { success: false, error: getErrorMessage(err) || translate(loc, 'bg_error_delete_folder') };
  }
}

export async function renameFolder(folderId: string, newName: string): Promise<FolderResult> {
  try {
    const renamed = await messenger.folders.rename(folderId, newName);
    return {
      success: true,
      folder: {
        id: renamed.id || `${renamed.accountId}:/${renamed.path}`,
        name: renamed.name,
        path: renamed.path,
      },
    };
  } catch (err: unknown) {
    logger.error('Error renaming folder', err);
    const loc = await getLocaleFromStorage();
    return { success: false, error: getErrorMessage(err) || translate(loc, 'bg_error_rename_folder') };
  }
}

export async function moveFolderContents(
  sourceFolderId: string,
  destFolderId: string,
  deleteSource: boolean,
): Promise<{ success: boolean; movedCount?: number; error?: string }> {
  if (!sourceFolderId || !destFolderId) {
    return { success: false, error: 'sourceFolderId and destFolderId required' };
  }

  try {
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
        // @ts-expect-error 'delete' is a reserved word in TS but valid Thunderbird API
        await messenger.folders.delete(sourceFolderId);
      } catch (delErr: unknown) {
        logger.error('Could not delete source folder', delErr);
      }
    }

    return { success: true, movedCount: msgIds.length };
  } catch (err: unknown) {
    logger.error('Error moving folder contents', err);
    return { success: false, error: getErrorMessage(err) || 'Error moving emails' };
  }
}

export async function getFolderTree(): Promise<AccountTree[]> {
  try {
    const accounts = await messenger.accounts.list();
    if (accounts.length === 0) return [];

    async function buildTree(folderId: string): Promise<FolderTreeNode[]> {
      const subFolders = await messenger.folders.getSubFolders(folderId);
      const nodes: FolderTreeNode[] = [];
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

    const trees: AccountTree[] = [];
    for (const account of accounts) {
      trees.push({
        accountName: account.name,
        accountId: account.id,
        folders: await buildTree(account.rootFolder.id),
      });
    }
    return trees;
  } catch (err: unknown) {
    logger.error('Error building folder tree', err);
    return [];
  }
}
