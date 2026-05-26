/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

export interface Condition {
  field: 'from' | 'to' | 'subject' | 'body' | 'hasAttachments';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'matches' | 'is';
  value: string;
  boolValue?: boolean;
  caseSensitive: boolean;
}

export interface Action {
  type: 'moveToFolder' | 'addTag' | 'setPriority' | 'markRead' | 'autoRespond';
  folderId?: string;
  tagKey?: string;
  priority?: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
  templateId?: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Condition[];
  conditionLogic: 'all' | 'any';
  actions: Action[];
  stopProcessing: boolean;
  createdAt: number;
  updatedAt: number;
}
