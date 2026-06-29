export { createMailAdapter, isMailConfigured, resetMailAdapterForTests } from "./factory";
export { NoopMailAdapter } from "./noop";
export { SmtpMailAdapter, type SmtpMailConfig } from "./smtp";
export {
    buildEmailVerificationUrl,
    buildInviteUrl,
    buildPasswordResetUrl,
    buildTeamMembersUrl,
    emailVerificationEmail,
    passwordResetEmail,
    teamInviteEmail,
    teamMemberAddedEmail
} from "./templates";
export type { MailAdapter, MailAdapterType, MailMessage } from "./types";

