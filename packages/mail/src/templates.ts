function webUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

function appName(): string {
  return process.env.MAIL_FROM_NAME?.trim() || "ServiceBeard";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p style="margin: 0 0 1rem;">${body}</p>
  <p style="margin: 2rem 0 0; font-size: 0.875rem; color: #666;">${escapeHtml(appName())}</p>
</body>
</html>`;
}

export function teamInviteEmail(input: {
  teamName: string;
  inviterName: string | null;
  role: string;
  inviteUrl: string;
}) {
  const inviter = input.inviterName?.trim() || "A team admin";
  const subject = `You're invited to join ${input.teamName} on ${appName()}`;
  const text = `${inviter} invited you to join "${input.teamName}" as ${input.role}.

Accept the invite:
${input.inviteUrl}

This invite expires in 7 days.`;

  const html = htmlLayout(
    subject,
    `${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(input.teamName)}</strong> as ${escapeHtml(input.role)}.<br><br>
<a href="${escapeHtml(input.inviteUrl)}">Accept invite</a><br><br>
This invite expires in 7 days.`,
  );

  return { subject, text, html };
}

export function passwordResetEmail(input: { resetUrl: string }) {
  const subject = `Reset your ${appName()} password`;
  const text = `We received a request to reset your password.

Reset your password:
${input.resetUrl}

If you did not request this, you can ignore this email. The link expires in 1 hour.`;

  const html = htmlLayout(
    subject,
    `We received a request to reset your password.<br><br>
<a href="${escapeHtml(input.resetUrl)}">Reset password</a><br><br>
If you did not request this, you can ignore this email. The link expires in 1 hour.`,
  );

  return { subject, text, html };
}

export function emailVerificationEmail(input: { verifyUrl: string }) {
  const subject = `Confirm your ${appName()} email address`;
  const text = `Thanks for signing up. Confirm your email address to finish creating your account.

Confirm email:
${input.verifyUrl}

If you did not create an account, you can ignore this email. The link expires in 24 hours.`;

  const html = htmlLayout(
    subject,
    `Thanks for signing up. Confirm your email address to finish creating your account.<br><br>
<a href="${escapeHtml(input.verifyUrl)}">Confirm email</a><br><br>
If you did not create an account, you can ignore this email. The link expires in 24 hours.`,
  );

  return { subject, text, html };
}

export function teamMemberAddedEmail(input: {
  teamName: string;
  inviterName: string | null;
  role: string;
  teamUrl: string;
}) {
  const inviter = input.inviterName?.trim() || "A team admin";
  const subject = `You've been added to ${input.teamName} on ${appName()}`;
  const text = `${inviter} added you to "${input.teamName}" as ${input.role}.

Open the team:
${input.teamUrl}`;

  const html = htmlLayout(
    subject,
    `${escapeHtml(inviter)} added you to <strong>${escapeHtml(input.teamName)}</strong> as ${escapeHtml(input.role)}.<br><br>
<a href="${escapeHtml(input.teamUrl)}">Open team</a>`,
  );

  return { subject, text, html };
}

export function buildInviteUrl(token: string): string {
  return `${webUrl()}/invites/${token}`;
}

export function buildPasswordResetUrl(token: string): string {
  return `${webUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildEmailVerificationUrl(token: string): string {
  return `${webUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildTeamMembersUrl(teamId: string): string {
  return `${webUrl()}/teams/${teamId}/members`;
}
