import {
  emailVerificationTokens,
  generateToken,
  getDb,
  hashToken,
  passwordResetTokens,
  users,
} from "@servicebeard/db";
import {
  buildEmailVerificationUrl,
  buildInviteUrl,
  buildPasswordResetUrl,
  buildTeamMembersUrl,
  createMailAdapter,
  emailVerificationEmail,
  isMailConfigured,
  passwordResetEmail,
  teamInviteEmail,
  teamMemberAddedEmail,
} from "@servicebeard/mail";
import { and, eq, gt, lt } from "drizzle-orm";
import { logger } from "./logger";
import { hashPassword } from "./login/password";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export { isMailConfigured };

export function shouldRequireEmailVerification(): boolean {
  return isMailConfigured();
}

function toSessionEmailVerified(user: {
  emailVerifiedAt: Date | null;
}): boolean {
  return user.emailVerifiedAt !== null;
}

export async function markEmailVerified(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, userId));
}

export async function ensureEmailVerifiedForLogin(
  userId: string,
): Promise<void> {
  if (!shouldRequireEmailVerification()) return;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { emailVerifiedAt: true },
  });
  if (!user?.emailVerifiedAt) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }
}

async function sendMail(
  to: string,
  content: { subject: string; text: string; html: string },
) {
  const adapter = createMailAdapter();
  if (!adapter.isConfigured()) {
    logger.warn(
      { to, subject: content.subject },
      "mail not configured; skipping send",
    );
    return;
  }

  try {
    await adapter.send({
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  } catch (err) {
    logger.error({ err, to, subject: content.subject }, "failed to send email");
    throw new Error("MAIL_SEND_FAILED");
  }
}

export async function sendTeamInviteEmail(input: {
  to: string;
  teamName: string;
  inviterName: string | null;
  role: string;
  token: string;
}): Promise<void> {
  const content = teamInviteEmail({
    teamName: input.teamName,
    inviterName: input.inviterName,
    role: input.role,
    inviteUrl: buildInviteUrl(input.token),
  });
  await sendMail(input.to, content);
}

export async function sendTeamMemberAddedEmail(input: {
  to: string;
  teamId: string;
  teamName: string;
  inviterName: string | null;
  role: string;
}): Promise<void> {
  const content = teamMemberAddedEmail({
    teamName: input.teamName,
    inviterName: input.inviterName,
    role: input.role,
    teamUrl: buildTeamMembersUrl(input.teamId),
  });
  await sendMail(input.to, content);
}

export async function issueEmailVerification(input: {
  userId: string;
  email: string;
}): Promise<string | null> {
  if (!shouldRequireEmailVerification()) {
    await markEmailVerified(input.userId);
    return null;
  }

  const token = generateToken();
  const db = getDb();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, input.userId));
  await db.insert(emailVerificationTokens).values({
    userId: input.userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const content = emailVerificationEmail({
    verifyUrl: buildEmailVerificationUrl(token),
  });
  await sendMail(input.email, content);
  return token;
}

export async function verifyEmailWithToken(
  token: string,
): Promise<{ userId: string }> {
  const db = getDb();
  const row = await db.query.emailVerificationTokens.findFirst({
    where: and(
      eq(emailVerificationTokens.tokenHash, hashToken(token)),
      gt(emailVerificationTokens.expiresAt, new Date()),
    ),
  });

  if (!row) {
    throw new Error("INVALID_VERIFICATION_TOKEN");
  }

  await markEmailVerified(row.userId);
  return { userId: row.userId };
}

export async function resendEmailVerification(userId: string): Promise<void> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, emailVerifiedAt: true },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }
  if (user.emailVerifiedAt) {
    throw new Error("EMAIL_ALREADY_VERIFIED");
  }

  await issueEmailVerification({ userId: user.id, email: user.email });
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
    columns: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    return;
  }

  if (!isMailConfigured()) {
    logger.warn(
      { email: normalizedEmail },
      "password reset requested but mail is not configured",
    );
    return;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const content = passwordResetEmail({
    resetUrl: buildPasswordResetUrl(token),
    hasExistingPassword: Boolean(user.passwordHash),
  });
  await sendMail(user.email, content);
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<void> {
  if (!password) {
    throw new Error("INVALID_PASSWORD");
  }

  const db = getDb();
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, hashToken(token)),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  });

  if (!row) {
    throw new Error("INVALID_RESET_TOKEN");
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, row.userId));
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, row.userId));
  await markEmailVerified(row.userId);
}

export async function purgeExpiredAuthTokens(): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, now));
  await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, now));
}

export { toSessionEmailVerified };
