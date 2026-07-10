import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    const connectionString =
      process.env.DATABASE_URL ??
      "postgres://servicebeard:servicebeard@localhost:5432/servicebeard";
    boss = new PgBoss(connectionString);
    await boss.start();
  }
  return boss;
}

export async function closeBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}

export const QUEUE_NAMES = {
  IMAP_POLL: "imap-poll",
  COMMENT_POLL: "comment-poll",
  SEND_EMAIL: "send-email",
  ENSURE_WEBHOOK: "ensure-webhook",
} as const;
