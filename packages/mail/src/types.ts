export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface MailAdapter {
  readonly type: string;
  isConfigured(): boolean;
  send(message: MailMessage): Promise<void>;
}

export type MailAdapterType = "smtp" | "noop";
