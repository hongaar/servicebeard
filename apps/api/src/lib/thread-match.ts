import { emailMessages, getDb, issueThreads } from "@servicebeard/db";
import {
  buildThreadMatchIndex,
  type ThreadMatchIndex,
} from "@servicebeard/shared";
import { eq } from "drizzle-orm";

export async function loadProjectThreadMatchIndex(
  projectId: string,
): Promise<ThreadMatchIndex> {
  const db = getDb();
  const [storedMessages, threads] = await Promise.all([
    db
      .select({
        messageId: emailMessages.messageId,
        inReplyTo: emailMessages.inReplyTo,
      })
      .from(emailMessages)
      .where(eq(emailMessages.projectId, projectId)),
    db
      .select({
        subjectNormalized: issueThreads.subjectNormalized,
        originalSenderEmail: issueThreads.originalSenderEmail,
        lastActivityAt: issueThreads.updatedAt,
      })
      .from(issueThreads)
      .where(eq(issueThreads.projectId, projectId)),
  ]);

  return buildThreadMatchIndex(storedMessages, threads);
}
