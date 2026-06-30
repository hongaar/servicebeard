import * as nodemailer from "nodemailer";
import { smtpTlsOptions } from "./smtp-tls";
import type { MailAdapter, MailMessage } from "./types";

// Kept well under the reverse-proxy read timeout so an unreachable host fails
// fast instead of hanging until nodemailer's multi-minute default kicks in.
const CONNECTION_TIMEOUT = 8000;
const GREETING_TIMEOUT = 8000;
const SOCKET_TIMEOUT = 12000;

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
      connectionTimeout: CONNECTION_TIMEOUT,
      greetingTimeout: GREETING_TIMEOUT,
      socketTimeout: SOCKET_TIMEOUT,
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
