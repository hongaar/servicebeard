import {
  getBlockedMailPortsConfig,
  isBlockedMailPort,
} from "./mail-port-config";

export type MailEndpoint = {
  protocol: "IMAP" | "SMTP";
  host: string;
  port: number;
  secure: boolean;
};

type MailConnectionError = Error & {
  authenticationFailed?: boolean;
  response?: unknown;
  responseText?: string;
  serverResponseCode?: string;
};

function endpointLabel(endpoint: MailEndpoint): string {
  const encryption = endpoint.secure
    ? "TLS"
    : endpoint.protocol === "SMTP"
      ? "STARTTLS"
      : "plain";
  return `${endpoint.host}:${endpoint.port} (${encryption})`;
}

function mailErrorDetail(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const candidate = err as MailConnectionError;
  const parts = [
    candidate.responseText?.trim(),
    typeof candidate.response === "string" ? candidate.response.trim() : null,
  ].filter((value): value is string => Boolean(value));

  if (parts.length > 0) return parts.join(" ");
  return candidate.message;
}

function isAuthenticationFailure(err: unknown, detail: string): boolean {
  const candidate = err as MailConnectionError | null;
  if (candidate?.authenticationFailed) return true;

  const code = candidate?.serverResponseCode?.toUpperCase();
  if (code && /^(535|534|AUTHENTICATIONFAILED)$/.test(code)) return true;

  return /invalid login|authentication failed|\b535\b|\b534\b|login (?:is )?disabled|credentials? (?:invalid|rejected|failed)/i.test(
    detail,
  );
}

/** Turn low-level IMAP/SMTP errors into actionable messages for the UI. */
export function formatMailConnectionError(
  endpoint: MailEndpoint,
  err: unknown,
): Error {
  const detail = mailErrorDetail(err);
  const target = endpointLabel(endpoint);

  if (isAuthenticationFailure(err, detail)) {
    const suffix =
      detail && detail !== "Command failed"
        ? ` Server response: ${detail}`
        : "";
    return new Error(
      `${endpoint.protocol} authentication failed for ${target}. Check the username and password.${suffix}`,
    );
  }

  const raw = err instanceof Error ? err.message : String(err);
  const blockedPorts = getBlockedMailPortsConfig();

  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(raw)) {
    if (
      endpoint.protocol === "SMTP" &&
      isBlockedMailPort("smtp", endpoint.port, blockedPorts)
    ) {
      return new Error(
        `Could not reach the SMTP server at ${target} (timed out). ` +
          `Port ${endpoint.port} is blocked on this ServiceBeard instance; try port 587 with STARTTLS if your provider supports it.`,
      );
    }
    if (
      endpoint.protocol === "IMAP" &&
      isBlockedMailPort("imap", endpoint.port, blockedPorts)
    ) {
      return new Error(
        `Could not reach the IMAP server at ${target} (timed out). ` +
          `Port ${endpoint.port} is blocked on this ServiceBeard instance; try port 993 with TLS if your provider supports it.`,
      );
    }
    return new Error(
      `Could not reach the ${endpoint.protocol} server at ${target} (timed out). ` +
        `Check the hostname, port, and that outbound connections are allowed from this server.`,
    );
  }

  if (
    /connection closed|ECONNRESET|socket hang up|EPIPE|unexpected eof/i.test(
      raw,
    )
  ) {
    if (
      endpoint.protocol === "SMTP" &&
      isBlockedMailPort("smtp", endpoint.port, blockedPorts)
    ) {
      return new Error(
        `SMTP connection to ${target} was closed before the handshake completed. ` +
          `Port ${endpoint.port} is blocked on this ServiceBeard instance; try port 587 with STARTTLS if your provider supports it.`,
      );
    }
    if (
      endpoint.protocol === "IMAP" &&
      isBlockedMailPort("imap", endpoint.port, blockedPorts)
    ) {
      return new Error(
        `IMAP connection to ${target} was closed before the handshake completed. ` +
          `Port ${endpoint.port} is blocked on this ServiceBeard instance; try port 993 with TLS if your provider supports it.`,
      );
    }
    return new Error(
      `${endpoint.protocol} connection to ${target} was closed unexpectedly. ` +
        `Verify the host, port, and encryption setting match your mail provider.`,
    );
  }

  if (/ECONNREFUSED|connection refused/i.test(raw)) {
    return new Error(
      `${endpoint.protocol} connection refused by ${target}. The server may be down or the port is incorrect.`,
    );
  }

  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(raw)) {
    return new Error(
      `Could not resolve ${endpoint.protocol} hostname "${endpoint.host}". Check the server address.`,
    );
  }

  if (/certificate|altnames|TLS|SSL|UNABLE_TO_VERIFY/i.test(raw)) {
    return new Error(
      `${endpoint.protocol} TLS handshake failed for ${target}: ${raw}`,
    );
  }

  if (raw === "Command failed" && detail !== raw) {
    return new Error(
      `${endpoint.protocol} connection to ${target} failed: ${detail}`,
    );
  }

  return new Error(
    `${endpoint.protocol} connection to ${target} failed: ${raw}`,
  );
}
