function formatPerson(email: string, name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? `${trimmed} <${email}>` : email;
}

export function formatCreateIssueSuccess(input: {
  issueIid: number;
  subject: string;
  senderEmail: string;
  senderName?: string | null;
}): string {
  const sender = formatPerson(input.senderEmail, input.senderName);
  return `Created issue #${input.issueIid} from email "${input.subject}" (${sender})`;
}

export function formatAddIssueCommentSuccess(input: {
  issueIid: number;
  senderEmail: string;
  senderName?: string | null;
}): string {
  const sender = formatPerson(input.senderEmail, input.senderName);
  return `Posted customer reply from ${sender} as a comment on issue #${input.issueIid}`;
}

export function formatSendAckInfo(input: {
  issueIid: number;
  recipientEmail: string;
  recipientName?: string | null;
}): string {
  const recipient = formatPerson(input.recipientEmail, input.recipientName);
  return `Sent acknowledgement email to ${recipient} for issue #${input.issueIid}`;
}

export function formatReopenIssueSuccess(input: {
  issueIid: number;
  senderEmail: string;
  senderName?: string | null;
}): string {
  const sender = formatPerson(input.senderEmail, input.senderName);
  return `Reopened issue #${input.issueIid} after customer reply from ${sender}`;
}

export function formatSendOutboundEmailSuccess(input: {
  issueIid: number;
  recipientEmail: string;
  recipientName?: string | null;
  authorName: string;
}): string {
  const recipient = formatPerson(input.recipientEmail, input.recipientName);
  return `Sent comment by ${input.authorName} to ${recipient} for issue #${input.issueIid}`;
}
