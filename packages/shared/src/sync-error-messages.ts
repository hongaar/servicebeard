const SERVICE_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  linear: "Linear",
  imap: "IMAP mailbox",
  smtp: "SMTP server",
  inbound: "inbound email processing",
  "outbound-email": "outbound email processing",
};

const OPERATION_LABELS: Record<string, string> = {
  poll: "polling the mailbox",
  "fetch-since": "fetching new mailbox messages",
  "imap-poll-project": "polling the mailbox",
  "imap-poll": "polling mailboxes",
  "process-message": "processing an inbound email",
  "list-comments": "checking for new issue comments",
  "comment-poll-project": "polling issue comments",
  "comment-poll": "polling issue comments",
  "send-mail": "sending email",
  "send-email": "sending email",
  "ensure-webhook": "registering the webhook",
  "test-provider": "testing the issue provider connection",
  "test-mail": "testing mail connectivity",
  "upload-inline-image": "uploading an inline image",
  "download-image": "downloading an image attachment",
};

function serviceLabel(service: string): string {
  return SERVICE_LABELS[service] ?? service;
}

function operationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation.replaceAll("-", " ");
}

export function describeSyncOperation(
  service: string,
  operation: string,
): { target: string; action: string } {
  return {
    target: serviceLabel(service),
    action: operationLabel(operation),
  };
}

function imapResponseDetail(err: Error): string | null {
  const candidate = err as Error & {
    responseText?: string;
    executedCommand?: string;
  };
  if (candidate.responseText?.trim()) return candidate.responseText.trim();
  return null;
}

export function humanizeSyncErrorMessage(
  service: string,
  operation: string,
  err: unknown,
): string {
  if (!(err instanceof Error)) return String(err);

  const { target, action } = describeSyncOperation(service, operation);
  const message = err.message.trim();
  const lower = message.toLowerCase();

  if (lower === "command failed") {
    const detail = imapResponseDetail(err);
    if (detail) {
      return `${target} rejected a command while ${action}: ${detail}`;
    }
    return `${target} command failed while ${action}`;
  }

  if (lower.includes("unsupported state or unable to authenticate data")) {
    return "Could not decrypt stored credentials for this project";
  }

  if (lower.includes("was there a typo in the url or port")) {
    return `Invalid URL or port while ${action} (${target})`;
  }

  if (
    lower.includes("unable to connect. is the computer able to access the url")
  ) {
    return `Could not connect to ${target} while ${action}`;
  }

  if (lower.includes("socket connection was closed unexpectedly")) {
    return `Connection to ${target} was closed unexpectedly while ${action}`;
  }

  if (lower.includes("certificate") && lower.includes("expired")) {
    return `TLS certificate for ${target} has expired while ${action}`;
  }

  if (lower.includes("self signed certificate")) {
    return `TLS certificate for ${target} is not trusted while ${action}`;
  }

  if (lower.includes("getaddrinfo") || lower.includes("enotfound")) {
    return `Could not resolve the hostname for ${target} while ${action}`;
  }

  if (lower.includes("econnrefused")) {
    return `Connection refused by ${target} while ${action}`;
  }

  if (lower.includes("etimedout") || lower.includes("timed out")) {
    return `Connection to ${target} timed out while ${action}`;
  }

  return message;
}
