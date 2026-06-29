import type { MailAdapter, MailMessage } from "./types";

export class NoopMailAdapter implements MailAdapter {
  readonly type = "noop";

  isConfigured(): boolean {
    return false;
  }

  async send(message: MailMessage): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      console.info("[mail:noop] would send email", {
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
      });
    }
  }
}
