export type MailEndpoint = {
  protocol: "IMAP" | "SMTP";
  host: string;
  port: number;
  secure: boolean;
};

function endpointLabel(endpoint: MailEndpoint): string {
  const encryption = endpoint.secure
    ? "TLS"
    : endpoint.protocol === "SMTP"
      ? "STARTTLS"
      : "plain";
  return `${endpoint.host}:${endpoint.port} (${encryption})`;
}

/** Turn low-level IMAP/SMTP errors into actionable messages for the UI. */
export function formatMailConnectionError(
  endpoint: MailEndpoint,
  err: unknown,
): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const target = endpointLabel(endpoint);

  if (
    /invalid login|authentication failed|\b535\b|\b534\b|\bauth\b/i.test(raw)
  ) {
    return new Error(
      `${endpoint.protocol} authentication failed for ${target}. Check the username and password.`,
    );
  }

  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(raw)) {
    if (
      endpoint.protocol === "SMTP" &&
      (endpoint.port === 465 || endpoint.port === 25)
    ) {
      return new Error(
        `Could not reach the SMTP server at ${target} (timed out). ` +
          `Port ${endpoint.port} is often blocked by cloud hosts; try port 587 with STARTTLS if your provider supports it.`,
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
      endpoint.secure &&
      endpoint.port === 465
    ) {
      return new Error(
        `SMTP connection to ${target} was closed before the handshake completed. ` +
          `Port 465 is often blocked by cloud hosts; try port 587 with STARTTLS if your provider supports it.`,
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

  return new Error(
    `${endpoint.protocol} connection to ${target} failed: ${raw}`,
  );
}
