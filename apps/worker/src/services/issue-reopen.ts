import type { IssueProvider } from "@servicebeard/providers";
import {
  formatReopenIssueSuccess,
  resolveReopenStatus,
} from "@servicebeard/shared";
import {
  logExternalError,
  recordProjectSyncEvent,
} from "../lib/external-error";
import { logger } from "../lib/logger";

export type ClosedIssueReplyAction = "comment" | "reopen" | "create-new-issue";

interface ReopenContext {
  projectId: string;
  providerName: string;
  rules: Array<{
    id: string;
    actionStatus: string | null;
    actionReopenOnReply: boolean;
  }>;
}

interface ReopenThread {
  id: string;
  issueIid: number;
  matchedRuleId: string | null;
  issueMissingAt: Date | null;
}

interface ReopenEmail {
  senderEmail: string;
  senderName: string | null;
}

export async function resolveClosedIssueReply(
  provider: IssueProvider,
  project: ReopenContext,
  thread: ReopenThread,
): Promise<ClosedIssueReplyAction> {
  if (thread.issueMissingAt) return "comment";

  const matchedRule = project.rules.find(
    (rule) => rule.id === thread.matchedRuleId,
  );
  const reopenEnabled = matchedRule?.actionReopenOnReply ?? true;

  try {
    const state = await provider.getIssueState(thread.issueIid);
    if (!state?.closed) return "comment";
    if (!reopenEnabled) return "create-new-issue";
    return "reopen";
  } catch (err) {
    logExternalError(project.providerName, "get-issue-state", err, {
      projectId: project.projectId,
      threadId: thread.id,
      issueIid: thread.issueIid,
    });
    return "comment";
  }
}

export async function reopenIssueOnReply(
  provider: IssueProvider,
  project: ReopenContext,
  thread: ReopenThread,
  email: ReopenEmail,
): Promise<boolean> {
  const matchedRule = project.rules.find(
    (rule) => rule.id === thread.matchedRuleId,
  );

  try {
    const defaultOpenStatus = await provider.getDefaultOpenStatus();
    const targetStatus = resolveReopenStatus(
      matchedRule?.actionStatus,
      defaultOpenStatus,
    );

    await provider.updateIssueStatus(thread.issueIid, targetStatus);

    logger.info(
      {
        threadId: thread.id,
        issueIid: thread.issueIid,
        targetStatus,
      },
      "reopened issue after customer reply",
    );
    recordProjectSyncEvent({
      projectId: project.projectId,
      service: project.providerName,
      operation: "reopen-issue",
      severity: "success",
      message: formatReopenIssueSuccess({
        issueIid: thread.issueIid,
        senderEmail: email.senderEmail,
        senderName: email.senderName,
      }),
      metadata: {
        threadId: thread.id,
        issueIid: thread.issueIid,
        targetStatus,
      },
    });
    return true;
  } catch (err) {
    logExternalError(project.providerName, "reopen-issue", err, {
      projectId: project.projectId,
      threadId: thread.id,
      issueIid: thread.issueIid,
    });
    return false;
  }
}
