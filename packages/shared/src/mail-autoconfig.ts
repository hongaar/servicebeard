export interface MailServerSettings {
  host: string;
  port: number;
  secure: boolean;
}

export interface MailAutoconfig {
  imap: MailServerSettings;
  smtp: MailServerSettings;
  /** Human-readable provider name when matched from a known domain. */
  providerName?: string;
}

/** Well-known IMAP/SMTP settings for common mail providers (domain → config). */
const PROVIDERS: Record<string, MailAutoconfig & { providerName: string }> = {
  "gmail.com": {
    providerName: "Gmail",
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
  },
  "googlemail.com": {
    providerName: "Gmail",
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
  },
  "outlook.com": {
    providerName: "Outlook",
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  "hotmail.com": {
    providerName: "Outlook",
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  "live.com": {
    providerName: "Outlook",
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  "office365.com": {
    providerName: "Microsoft 365",
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
  },
  "yahoo.com": {
    providerName: "Yahoo Mail",
    imap: { host: "imap.mail.yahoo.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
  },
  "ymail.com": {
    providerName: "Yahoo Mail",
    imap: { host: "imap.mail.yahoo.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
  },
  "icloud.com": {
    providerName: "iCloud",
    imap: { host: "imap.mail.me.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
  },
  "me.com": {
    providerName: "iCloud",
    imap: { host: "imap.mail.me.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
  },
  "mac.com": {
    providerName: "iCloud",
    imap: { host: "imap.mail.me.com", port: 993, secure: true },
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
  },
  "fastmail.com": {
    providerName: "Fastmail",
    imap: { host: "imap.fastmail.com", port: 993, secure: true },
    smtp: { host: "smtp.fastmail.com", port: 465, secure: true },
  },
  "fastmail.fm": {
    providerName: "Fastmail",
    imap: { host: "imap.fastmail.com", port: 993, secure: true },
    smtp: { host: "smtp.fastmail.com", port: 465, secure: true },
  },
  "zoho.com": {
    providerName: "Zoho Mail",
    imap: { host: "imap.zoho.com", port: 993, secure: true },
    smtp: { host: "smtp.zoho.com", port: 465, secure: true },
  },
  "mail.test": {
    providerName: "GreenMail (local dev)",
    imap: { host: "localhost", port: 3143, secure: false },
    smtp: { host: "localhost", port: 3025, secure: false },
  },
  "proton.me": {
    providerName: "Proton Mail",
    imap: { host: "127.0.0.1", port: 1143, secure: false },
    smtp: { host: "127.0.0.1", port: 1025, secure: false },
  },
  "protonmail.com": {
    providerName: "Proton Mail",
    imap: { host: "127.0.0.1", port: 1143, secure: false },
    smtp: { host: "127.0.0.1", port: 1025, secure: false },
  },
};

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

/** GreenMail (docker compose) uses local-part IMAP/SMTP logins for @mail.test mailboxes. */
export function usesLocalPartMailAuth(email: string): boolean {
  return extractEmailDomain(email) === "mail.test";
}

/** Prefilled mailbox settings for local GreenMail (see README). */
export const GREENMAIL_DEV_PROJECT_MAIL = {
  smtpFrom: "support@mail.test",
  imapHost: "localhost",
  imapPort: 3143,
  imapSecure: false,
  imapUser: "support",
  imapPassword: "support",
  smtpHost: "localhost",
  smtpPort: 3025,
  smtpSecure: false,
  smtpUser: "support",
  smtpPassword: "support",
} as const;

/** Look up IMAP/SMTP defaults for a support email address. */
export function lookupMailAutoconfig(email: string): MailAutoconfig | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  return PROVIDERS[domain] ?? null;
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
