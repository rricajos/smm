export interface ResponseTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isPlainText: boolean;
  sendMode: 'draft' | 'sendNow' | 'sendLater';
  replyType: 'replyToSender' | 'replyToAll';
}
