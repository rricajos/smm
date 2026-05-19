// Type declarations for Thunderbird's messenger WebExtension APIs
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

    function get(messageId: number): Promise<MessageHeader>;
    function getFull(messageId: number): Promise<MessagePart>;
    function query(queryInfo: Record<string, any>): Promise<MessageList>;
    function move(messageIds: number[], destination: string): Promise<void>;
    function update(messageId: number, newProperties: Partial<{
      read: boolean;
      flagged: boolean;
      tags: string[];
    }>): Promise<void>;
    function listAttachments(messageId: number): Promise<Attachment[]>;

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
      id?: string;
    }

    function getSubFolders(folderOrAccount: MailFolder | accounts.MailAccount): Promise<MailFolder[]>;
  }

  namespace accounts {
    interface MailAccount {
      id: string;
      name: string;
      type: string;
      identities: MailIdentity[];
      folders: folders.MailFolder[];
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
  }

  namespace messageDisplay {
    function getDisplayedMessages(tabId?: number): Promise<messages.MessageHeader[]>;
  }

  namespace tabs {
    function remove(tabId: number): Promise<void>;
    function query(queryInfo: Record<string, any>): Promise<{ id: number }[]>;
  }

  namespace runtime {
    function sendMessage(message: any): Promise<any>;
    const onMessage: {
      addListener(callback: (message: any, sender: any, sendResponse: Function) => boolean | void | Promise<any>): void;
    };
  }

  namespace storage {
    const local: {
      get(keys: string | string[]): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    const onChanged: {
      addListener(callback: (changes: Record<string, { oldValue?: any; newValue?: any }>, areaName: string) => void): void;
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
};

declare const messenger: typeof messenger;
