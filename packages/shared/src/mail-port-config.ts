export type MailPortProtocol = "imap" | "smtp";

export type BlockedMailPortsConfig = {
  blockedImapPorts: number[];
  blockedSmtpPorts: number[];
};

function parseBlockedPorts(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];

  const ports = new Set<number>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const port = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) continue;
    ports.add(port);
  }

  return [...ports].sort((a, b) => a - b);
}

export function getBlockedImapPorts(): number[] {
  return parseBlockedPorts(process.env.BLOCKED_IMAP_PORTS);
}

export function getBlockedSmtpPorts(): number[] {
  return parseBlockedPorts(process.env.BLOCKED_SMTP_PORTS);
}

export function getBlockedMailPortsConfig(): BlockedMailPortsConfig {
  return {
    blockedImapPorts: getBlockedImapPorts(),
    blockedSmtpPorts: getBlockedSmtpPorts(),
  };
}

export function isBlockedMailPort(
  protocol: MailPortProtocol,
  port: number,
  config: BlockedMailPortsConfig = getBlockedMailPortsConfig(),
): boolean {
  const blocked =
    protocol === "imap" ? config.blockedImapPorts : config.blockedSmtpPorts;
  return blocked.includes(port);
}

export function getBlockedMailPortWarning(
  protocol: MailPortProtocol,
  port: number,
  config: BlockedMailPortsConfig = getBlockedMailPortsConfig(),
): string | null {
  if (!isBlockedMailPort(protocol, port, config)) return null;

  const label = protocol === "imap" ? "IMAP" : "SMTP";
  const alternative =
    protocol === "imap"
      ? "Try port 993 with TLS if your provider supports it."
      : "Try port 587 with STARTTLS if your provider supports it.";

  return (
    `Port ${port} is blocked on this ServiceBeard instance. ` +
    `Outbound ${label} connections to this port may fail. ${alternative}`
  );
}

export function getBlockedMailPortWarnings(
  imapPort: number,
  smtpPort: number,
  config: BlockedMailPortsConfig = getBlockedMailPortsConfig(),
): string[] {
  const warnings: string[] = [];
  const imapWarning = getBlockedMailPortWarning("imap", imapPort, config);
  const smtpWarning = getBlockedMailPortWarning("smtp", smtpPort, config);
  if (imapWarning) warnings.push(imapWarning);
  if (smtpWarning) warnings.push(smtpWarning);
  return warnings;
}
