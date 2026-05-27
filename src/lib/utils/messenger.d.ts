/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

// Type declarations for Thunderbird's messenger WebExtension APIs (TB 128+)
declare namespace messenger {
  namespace messages {
    interface MessageHeader {
      id: number;
      date: Date;
      author: string;
      recipients: string[];
      ccList: string[];
      bccList: string[];
      subject: string;
      read: boolean;
      flagged: boolean;
      tags: string[];
      folder: folders.MailFolder;
      headerMessageId: string;
      size: number;
    }

    interface MessagePart {
      contentType: string;
      headers?: Record<string, string[]>;
      body?: string;
      parts?: MessagePart[];
    }

    interface MessageList {
      id?: string;
      messages: MessageHeader[];
    }

    interface Attachment {
      contentType: string;
      name: string;
      size: number;
      partName: string;
    }

    interface MessageTag {
      key: string;
      tag: string;
      color: string;
      ordinal: string;
    }

    function get(messageId: number): Promise<MessageHeader>;
    function getFull(messageId: number): Promise<MessagePart>;
    function query(queryInfo: Record<string, unknown>): Promise<MessageList>;
    function list(folderId: string): Promise<MessageList>;
    function continueList(listId: string): Promise<MessageList>;
    function move(messageIds: number[], destination: string): Promise<void>;
    function update(messageId: number, newProperties: Partial<{
      read: boolean;
      flagged: boolean;
      tags: string[];
    }>): Promise<void>;
    function listAttachments(messageId: number): Promise<Attachment[]>;

    namespace tags {
      function list(): Promise<MessageTag[]>;
      function create(key: string, tag: string, color: string): Promise<void>;
      function update(key: string, updateProperties: { tag?: string; color?: string }): Promise<void>;
      // 'delete' is a reserved word, declared via interface
    }

    const onNewMailReceived: {
      addListener(callback: (folder: folders.MailFolder, messages: MessageList) => void): void;
      removeListener(callback: Function): void;
    };
  }

  namespace folders {
    interface MailFolder {
      accountId: string;
      name: string;
      path: string;
      type?: string;
      id: string;
      totalMessageCount?: number;
      unreadMessageCount?: number;
    }

    interface MailFolderInfo {
      totalMessageCount: number;
      unreadMessageCount: number;
    }

    function getSubFolders(folderIdOrAccount: string): Promise<MailFolder[]>;
    function create(parentFolderId: string, childName: string): Promise<MailFolder>;
    function rename(folderId: string, newName: string): Promise<MailFolder>;
    function getFolderInfo(folderId: string): Promise<MailFolderInfo>;
  }

  // folders.delete is a reserved word — use bracket syntax at call sites
  // Declared via interface merge
  interface FoldersNamespace {
    delete(folderId: string): Promise<void>;
  }

  namespace accounts {
    interface MailAccount {
      id: string;
      name: string;
      type: string;
      identities: MailIdentity[];
      folders: folders.MailFolder[];
      rootFolder: { id: string };
    }

    interface MailIdentity {
      accountId: string;
      email: string;
      name: string;
    }

    function list(): Promise<MailAccount[]>;
    function get(accountId: string): Promise<MailAccount>;
  }

  namespace compose {
    interface ComposeDetails {
      subject?: string;
      body?: string;
      plainTextBody?: string;
      isPlainText?: boolean;
      to?: string[];
      cc?: string[];
      bcc?: string[];
    }

    function beginReply(
      messageId: number,
      replyType: 'replyToSender' | 'replyToAll',
      details?: ComposeDetails,
    ): Promise<{ id: number }>;

    function sendMessage(tabId: number, options?: { mode: 'sendNow' | 'sendLater' }): Promise<void>;
    function saveMessage(tabId: number, options?: { mode: 'draft' }): Promise<void>;
  }

  namespace spacesToolbar {
    function addButton(
      id: string,
      properties: {
        title: string;
        url: string;
        defaultIcons?: string | Record<string, string>;
      },
    ): Promise<void>;
    function clickButton(id: string): Promise<void>;
  }

  namespace messageDisplay {
    function getDisplayedMessages(tabId?: number): Promise<messages.MessageHeader[]>;
  }

  namespace tabs {
    function remove(tabId: number): Promise<void>;
    function query(queryInfo: Record<string, unknown>): Promise<{ id: number }[]>;
  }

  namespace runtime {
    function sendMessage(message: unknown): Promise<unknown>;
    const onMessage: {
      addListener(callback: (message: unknown, sender: unknown, sendResponse: Function) => boolean | void | Promise<unknown>): void;
    };
  }

  namespace storage {
    const local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    const onChanged: {
      addListener(callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void): void;
    };
  }

  namespace notifications {
    function create(
      id: string,
      options: {
        type: 'basic';
        title: string;
        message: string;
        iconUrl?: string;
      },
    ): Promise<string>;
  }
}

// Also declare as browser.* since Thunderbird uses the browser namespace
declare const browser: typeof messenger & {
  storage: typeof messenger.storage;
  runtime: typeof messenger.runtime;
  notifications: typeof messenger.notifications;
  permissions: {
    request(permissions: { origins?: string[] }): Promise<boolean>;
  };
};

declare const messenger: typeof messenger;
