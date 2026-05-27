/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { ActivityEntry } from '../types/settings';
import {
  getTemplates,
  getSettings,
  incrementAutoResponseCount,
  checkRateLimit,
  appendActivityLog,
} from '../lib/utils/storage';
import { renderTemplate, extractName, extractEmail } from '../lib/utils/template-engine';
import { isAutoSubmitted, isMailingList, getOwnAddresses } from './message-utils';
import { getLocaleFromStorage, translate } from '../lib/i18n';
import { logger } from '../lib/utils/logger';

/// <reference path="../lib/utils/messenger.d.ts" />

export async function triggerAutoResponse(
  header: messenger.messages.MessageHeader,
  fullMessage: messenger.messages.MessagePart | null,
  templateId: string,
): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoResponseEnabled) return;

  // Safety checks
  if (fullMessage) {
    if (isAutoSubmitted(fullMessage)) {
      logger.debug('Skipping auto-response: auto-submitted message');
      return;
    }
    if (isMailingList(fullMessage)) {
      logger.debug('Skipping auto-response: mailing list message');
      return;
    }
  }

  // Don't respond to own addresses
  const ownAddresses = await getOwnAddresses();
  const senderEmail = extractEmail(header.author || '').toLowerCase();
  if (ownAddresses.includes(senderEmail)) {
    logger.debug('Skipping auto-response: message from own account');
    return;
  }

  // Don't respond to messages in Sent/Drafts/Trash
  const folderType = header.folder?.type;
  if (folderType === 'sent' || folderType === 'drafts' || folderType === 'trash') {
    logger.debug('Skipping auto-response: message in excluded folder');
    return;
  }

  // Rate limiting
  const canSend = await checkRateLimit(settings.maxAutoResponsesPerHour);
  if (!canSend) {
    const logEntry: ActivityEntry = {
      timestamp: Date.now(),
      ruleId: '',
      ruleName: '',
      messageId: header.id,
      subject: header.subject || '',
      from: header.author || '',
      actions: ['autoRespond'],
      type: 'error',
      details: 'Rate limit exceeded - auto-response skipped',
    };
    await appendActivityLog(logEntry);
    return;
  }

  // Find template
  const templates = await getTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    logger.error(`Template not found: ${templateId}`);
    return;
  }

  // Build template variables
  const now = new Date();
  const loc = await getLocaleFromStorage();
  const dayKeys = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'] as const;
  const days = dayKeys.map(k => translate(loc, k));

  // Get body text if full message available
  let bodyText = '';
  if (fullMessage) {
    const { extractBodyText } = await import('./message-utils');
    bodyText = extractBodyText(fullMessage);
  }

  // Get account info for my_name / my_email (use the message's account)
  let myName = '';
  let myEmail = '';
  try {
    const accounts = await messenger.accounts.list();
    if (accounts.length > 0) {
      const msgAccount = accounts.find((a) => a.id === header.folder?.accountId) || accounts[0];
      const identity = msgAccount.identities?.[0];
      myName = identity?.name || msgAccount.name || '';
      myEmail = identity?.email || '';
    }
  } catch (err) { logger.warn('Could not fetch account info for auto-response', err); }

  const variables: Record<string, string> = {
    // Legacy keys (backwards compatible)
    senderName: extractName(header.author || ''),
    senderEmail: senderEmail,
    originalSubject: header.subject || '',
    date: now.toLocaleDateString(loc === 'en' ? 'en-US' : 'es-ES'),
    time: now.toLocaleTimeString(loc === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' }),
    // New variable keys
    sender_name: extractName(header.author || ''),
    sender_email: senderEmail,
    to: header.recipients?.[0] || myEmail,
    subject: header.subject || '',
    day_of_week: days[now.getDay()],
    original_body: bodyText,
    original_body_snippet: bodyText.substring(0, 200),
    my_name: myName,
    my_email: myEmail,
  };

  const renderedSubject = renderTemplate(template.subject, variables);
  const renderedBody = renderTemplate(template.body, variables);

  try {
    // Create the reply
    const composeDetails: messenger.compose.ComposeDetails = {
      subject: renderedSubject,
    };

    if (template.isPlainText) {
      composeDetails.plainTextBody = renderedBody;
      composeDetails.isPlainText = true;
    } else {
      composeDetails.body = renderedBody;
      composeDetails.isPlainText = false;
    }

    const composeTab = await messenger.compose.beginReply(
      header.id,
      template.replyType,
      composeDetails,
    );

    switch (template.sendMode) {
      case 'draft':
        await messenger.compose.saveMessage(composeTab.id, { mode: 'draft' });
        await messenger.tabs.remove(composeTab.id);
        break;
      case 'sendNow':
        await messenger.compose.sendMessage(composeTab.id, { mode: 'sendNow' });
        break;
      case 'sendLater':
        await messenger.compose.sendMessage(composeTab.id, { mode: 'sendLater' });
        break;
    }

    await incrementAutoResponseCount();

    const logEntry: ActivityEntry = {
      timestamp: Date.now(),
      ruleId: '',
      ruleName: template.name,
      messageId: header.id,
      subject: header.subject || '',
      from: header.author || '',
      actions: ['autoRespond'],
      type: 'autoResponse',
      details: `Template: ${template.name}, Mode: ${template.sendMode}`,
    };
    await appendActivityLog(logEntry);

    if (settings.notifyOnAutoResponse) {
      const notifKey = template.sendMode === 'draft' ? 'notif_auto_response_draft' : 'notif_auto_response_sent';
      messenger.notifications.create(`smm-auto-${Date.now()}`, {
        type: 'basic',
        title: 'Smart Mail Manager',
        message: translate(loc, notifKey, { subject: header.subject || '' }),
      });
    }
  } catch (err) {
    logger.error('Error sending auto-response', err);
    const logEntry: ActivityEntry = {
      timestamp: Date.now(),
      ruleId: '',
      ruleName: template.name,
      messageId: header.id,
      subject: header.subject || '',
      from: header.author || '',
      actions: ['autoRespond'],
      type: 'error',
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
    await appendActivityLog(logEntry);
  }
}
