import { normalizeMessageId, parseMailFromAddress } from "@serviceboard/shared";
import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

export interface SmtpCredentials {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
}

export interface OutboundEmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid: string;
}

export interface OutboundEmail {
  to: string;
  toName?: string | null;
  cc?: string | string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: OutboundEmailAttachment[];
  inReplyTo?: string | null;
  references?: string[];
}

export async function sendEmail(
  creds: SmtpCredentials,
  email: OutboundEmail,
): Promise<string> {
  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpSecure,
    auth: { user: creds.smtpUser, pass: creds.smtpPassword },
  });

  const domain = parseMailFromAddress(creds.smtpFrom).split("@")[1] ?? "serviceboard.local";
  const messageId = `<${randomBytes(16).toString("hex")}@${domain}>`;
  const inReplyTo = email.inReplyTo ? normalizeMessageId(email.inReplyTo) : undefined;
  const references = (email.references ?? []).map(normalizeMessageId);

  await transporter.sendMail({
    from: creds.smtpFrom,
    to: email.toName ? `"${email.toName}" <${email.to}>` : email.to,
    cc: email.cc,
    subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
    text: email.body,
    html: email.bodyHtml,
    attachments: email.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
      cid: attachment.cid,
    })),
    messageId,
    inReplyTo,
    references: references.length > 0 ? references.join(" ") : undefined,
  });

  return messageId;
}
