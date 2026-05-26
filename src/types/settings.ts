/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

export type AiProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'custom';

export interface Settings {
  classificationEnabled: boolean;
  autoResponseEnabled: boolean;
  processExistingOnStartup: boolean;
  maxAutoResponsesPerHour: number;
  logRetentionDays: number;
  notifyOnClassification: boolean;
  notifyOnAutoResponse: boolean;
  aiProvider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;
  customBaseUrl: string;
  aiConsentAccepted: boolean;
}

export interface ActivityEntry {
  timestamp: number;
  ruleId: string;
  ruleName: string;
  messageId: number;
  subject: string;
  from: string;
  actions: string[];
  type: 'classification' | 'autoResponse' | 'error';
  details?: string;
  accountId?: string;
}
