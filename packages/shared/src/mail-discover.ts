import type { MailAutoconfig, MailServerSettings } from "./mail-autoconfig";

export type MailDiscoverSource =
  | "mozilla-autoconfig"
  | "microsoft-autodiscover"
  | "dns-srv";

export interface MailDiscoverResult {
  found: boolean;
  config?: MailAutoconfig & { source: MailDiscoverSource };
}

function extractXmlTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function socketTypeToSecure(socketType: string | null, port: number): boolean {
  const normalized = socketType?.trim().toUpperCase() ?? "";
  if (normalized === "SSL") return true;
  if (normalized === "STARTTLS" || normalized === "PLAIN") return false;
  return port === 465 || port === 993;
}

function sslFlagToSecure(ssl: string | null, port: number): boolean {
  const normalized = ssl?.trim().toLowerCase() ?? "";
  if (normalized === "on" || normalized === "true") return true;
  if (normalized === "off" || normalized === "false") return false;
  return port === 465 || port === 993;
}

function parseServerBlock(
  block: string,
  hostTags: string[],
): MailServerSettings | null {
  const host =
    hostTags.map((tag) => extractXmlTag(block, tag)).find(Boolean) ?? null;
  const portRaw = extractXmlTag(block, "port") ?? extractXmlTag(block, "Port");
  const port = portRaw ? Number(portRaw) : NaN;
  if (!host || !Number.isFinite(port)) return null;

  const socketType =
    extractXmlTag(block, "socketType") ?? extractXmlTag(block, "Encryption");
  const ssl = extractXmlTag(block, "SSL");
  const secure = socketType
    ? socketTypeToSecure(socketType, port)
    : sslFlagToSecure(ssl, port);

  return { host, port, secure };
}

function providerLabelFromMozillaXml(xml: string, fallbackDomain: string): string {
  const displayName = extractXmlTag(xml, "displayName");
  if (displayName) return displayName;
  const providerId = xml.match(/<emailProvider\b[^>]*\bid="([^"]+)"/i)?.[1];
  if (providerId) return providerId;
  return fallbackDomain;
}

/** Parse Mozilla Thunderbird autoconfig XML (config-v1.1). */
export function parseMozillaAutoconfigXml(
  xml: string,
  domain: string,
): MailAutoconfig | null {
  const incomingBlocks =
    xml.match(/<incomingServer\b[^>]*>[\s\S]*?<\/incomingServer>/gi) ?? [];
  const outgoingBlocks =
    xml.match(/<outgoingServer\b[^>]*>[\s\S]*?<\/outgoingServer>/gi) ?? [];

  const imapBlock = incomingBlocks.find((block) =>
    /type\s*=\s*["']?imap["']?/i.test(block),
  );
  const smtpBlock = outgoingBlocks.find((block) =>
    /type\s*=\s*["']?smtp["']?/i.test(block),
  );
  if (!imapBlock || !smtpBlock) return null;

  const imap = parseServerBlock(imapBlock, ["hostname", "host", "server"]);
  const smtp = parseServerBlock(smtpBlock, ["hostname", "host", "server"]);
  if (!imap || !smtp) return null;

  return {
    imap,
    smtp,
    providerName: providerLabelFromMozillaXml(xml, domain),
  };
}

/** Parse Microsoft Outlook autodiscover XML (2006a response schema). */
export function parseMicrosoftAutodiscoverXml(
  xml: string,
  domain: string,
): MailAutoconfig | null {
  const protocolBlocks = xml.match(/<Protocol\b[^>]*>[\s\S]*?<\/Protocol>/gi) ?? [];

  const imapBlock = protocolBlocks.find((block) =>
    /<Type\b[^>]*>\s*IMAP\s*<\/Type>/i.test(block),
  );
  const smtpBlock = protocolBlocks.find((block) =>
    /<Type\b[^>]*>\s*SMTP\s*<\/Type>/i.test(block),
  );
  if (!imapBlock || !smtpBlock) return null;

  const imap = parseServerBlock(imapBlock, ["Server", "Hostname", "host"]);
  const smtp = parseServerBlock(smtpBlock, ["Server", "Hostname", "host"]);
  if (!imap || !smtp) return null;

  return {
    imap,
    smtp,
    providerName: domain,
  };
}

export function mailAutoconfigFromSrvRecords(
  imap: { name: string; port: number },
  smtp: { name: string; port: number },
  domain: string,
): MailAutoconfig {
  return {
    imap: {
      host: imap.name.replace(/\.$/, ""),
      port: imap.port,
      secure: imap.port === 993,
    },
    smtp: {
      host: smtp.name.replace(/\.$/, ""),
      port: smtp.port,
      secure: smtp.port === 465,
    },
    providerName: domain,
  };
}
