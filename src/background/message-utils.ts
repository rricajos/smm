/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

/// <reference path="../lib/utils/messenger.d.ts" />

export interface FolderWithAccount extends messenger.folders.MailFolder {
  accountName: string;
}

export function extractBodyText(messagePart: messenger.messages.MessagePart | null | undefined): string {
  if (!messagePart) return '';

  if (messagePart.body && messagePart.contentType === 'text/plain') {
    return messagePart.body;
  }

  if (messagePart.body && messagePart.contentType === 'text/html') {
    // Strip HTML tags for plain-text matching
    return messagePart.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (messagePart.parts) {
    // Prefer text/plain, fall back to text/html
    const plainPart = messagePart.parts.find((p) => p.contentType === 'text/plain');
    if (plainPart?.body) return plainPart.body;

    for (const part of messagePart.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }

  return '';
}

export async function hasAttachments(messageId: number): Promise<boolean> {
  try {
    const attachments = await messenger.messages.listAttachments(messageId);
    return attachments.length > 0;
  } catch {
    return false;
  }
}

export function getHeaderValue(messagePart: messenger.messages.MessagePart | null | undefined, headerName: string): string | undefined {
  if (!messagePart?.headers) return undefined;
  const values = messagePart.headers[headerName.toLowerCase()];
  return values?.[0];
}

export function isAutoSubmitted(messagePart: messenger.messages.MessagePart | null | undefined): boolean {
  const autoSubmitted = getHeaderValue(messagePart, 'auto-submitted');
  if (autoSubmitted && autoSubmitted !== 'no') return true;

  const suppress = getHeaderValue(messagePart, 'x-auto-response-suppress');
  if (suppress) return true;

  return false;
}

export function isMailingList(messagePart: messenger.messages.MessagePart | null | undefined): boolean {
  return !!getHeaderValue(messagePart, 'list-unsubscribe');
}

export async function getOwnAddresses(): Promise<string[]> {
  try {
    const accounts = await messenger.accounts.list();
    const addresses: string[] = [];
    for (const account of accounts) {
      for (const identity of account.identities || []) {
        if (identity.email) {
          addresses.push(identity.email.toLowerCase());
        }
      }
    }
    return addresses;
  } catch {
    return [];
  }
}

export async function getAllFolders(): Promise<FolderWithAccount[]> {
  const accounts = await messenger.accounts.list();
  const allFolders: FolderWithAccount[] = [];

  for (const account of accounts) {
    const folders = await collectFolders(account);
    allFolders.push(...folders.map((f) => ({
      ...f,
      accountName: account.name,
    })));
  }

  return allFolders;
}

async function collectFolders(folderOrAccount: messenger.folders.MailFolder | messenger.accounts.MailAccount): Promise<messenger.folders.MailFolder[]> {
  // Use rootFolder.id for accounts, .id for folders (TB 128+ requires MailFolderId)
  const folderId = ('rootFolder' in folderOrAccount) ? folderOrAccount.rootFolder.id : folderOrAccount.id!;
  const subFolders = await messenger.folders.getSubFolders(folderId);
  const result: messenger.folders.MailFolder[] = [];

  for (const folder of subFolders) {
    result.push(folder);
    const children = await collectFolders(folder);
    result.push(...children);
  }

  return result;
}
