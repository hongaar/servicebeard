import * as nodemailer from "nodemailer";
import { smtpTlsOptions } from "./smtp-tls";
import type { MailAdapter, MailMessage } from "./types";

export interface SmtpMailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  fromName?: string;
}

function formatFrom(config: SmtpMailConfig): string {
  if (config.fromName) {
    return `"${config.fromName}" <${config.from}>`;
  }
  return config.from;
}

export class SmtpMailAdapter implements MailAdapter {
  readonly type = "smtp";

  constructor(private readonly config: SmtpMailConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.host && this.config.from);
  }

  async send(message: MailMessage): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth:
        this.config.user && this.config.password
          ? { user: this.config.user, pass: this.config.password }
          : undefined,
      tls: smtpTlsOptions(this.config.host),
    });

    await transporter.sendMail({
      from: formatFrom(this.config),
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
