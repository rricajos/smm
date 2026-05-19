declare const messenger: any;

export function extractBodyText(messagePart: any): string {
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
    const plainPart = messagePart.parts.find((p: any) => p.contentType === 'text/plain');
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

export function getHeaderValue(messagePart: any, headerName: string): string | undefined {
  if (!messagePart?.headers) return undefined;
  const values = messagePart.headers[headerName.toLowerCase()];
  return values?.[0];
}

export function isAutoSubmitted(messagePart: any): boolean {
  const autoSubmitted = getHeaderValue(messagePart, 'auto-submitted');
  if (autoSubmitted && autoSubmitted !== 'no') return true;

  const suppress = getHeaderValue(messagePart, 'x-auto-response-suppress');
  if (suppress) return true;

  return false;
}

export function isMailingList(messagePart: any): boolean {
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

export async function getAllFolders(): Promise<any[]> {
  const accounts = await messenger.accounts.list();
  const allFolders: any[] = [];

  for (const account of accounts) {
    const folders = await collectFolders(account);
    allFolders.push(...folders.map((f: any) => ({
      ...f,
      accountName: account.name,
    })));
  }

  return allFolders;
}

async function collectFolders(folderOrAccount: any): Promise<any[]> {
  // Use rootFolder.id for accounts, .id for folders (TB 121+ requires MailFolderId)
  const folderId = folderOrAccount.rootFolder?.id ?? folderOrAccount.id;
  const subFolders = await messenger.folders.getSubFolders(folderId);
  const result: any[] = [];

  for (const folder of subFolders) {
    result.push(folder);
    const children = await collectFolders(folder);
    result.push(...children);
  }

  return result;
}
