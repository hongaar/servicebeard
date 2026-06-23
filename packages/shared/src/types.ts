import type { EmailDirection, ProviderType, TeamRole } from "./constants";

export interface EmailInlineImage {
  filename: string;
  contentType: string;
  content: Buffer;
  contentId: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: Date;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  provider: ProviderType;
  providerBaseUrl: string;
  providerProjectId: string;
  providerBotUserId: string | null;
  providerTlsInsecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  imapPollIntervalSeconds: number;
  commentPollIntervalSeconds: number;
  webhookEnabled: boolean;
  isActive: boolean;
  inboundAckEnabled: boolean;
  inboundAckTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Rule {
  id: string;
  projectId: string;
  name: string;
  priority: number;
  isEnabled: boolean;
  matchSender: string | null;
  matchSubject: string | null;
  matchBody: string | null;
  actionCreateIssue: boolean;
  actionStatus: string | null;
  actionLabels: string[];
  actionAssigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueThread {
  id: string;
  projectId: string;
  externalIssueId: string;
  issueIid: number;
  issueUrl: string;
  originalSenderEmail: string;
  originalSenderName: string | null;
  subjectNormalized: string;
  lastSeenNoteAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  projectId: string;
  direction: EmailDirection;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  subject: string | null;
  externalNoteId: string | null;
  processedAt: Date;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}
