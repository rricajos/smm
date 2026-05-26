/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

export interface ResponseTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isPlainText: boolean;
  sendMode: 'draft' | 'sendNow' | 'sendLater';
  replyType: 'replyToSender' | 'replyToAll';
}
