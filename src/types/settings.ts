export interface Settings {
  classificationEnabled: boolean;
  autoResponseEnabled: boolean;
  processExistingOnStartup: boolean;
  maxAutoResponsesPerHour: number;
  logRetentionDays: number;
  notifyOnClassification: boolean;
  notifyOnAutoResponse: boolean;
  openaiApiKey: string;
  openaiModel: string;
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
