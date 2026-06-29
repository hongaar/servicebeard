import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./index";
import { emailMessages } from "./schema";

export interface MessageVolumePoint {
  date: string;
  inbound: number;
  outbound: number;
}

export async function getProjectMessageVolume(
  projectId: string,
  since: Date,
): Promise<MessageVolumePoint[]> {
  const db = getDb();
  const rows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${emailMessages.processedAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      direction: emailMessages.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(emailMessages)
    .where(and(eq(emailMessages.projectId, projectId), gte(emailMessages.processedAt, since)))
    .groupBy(
      sql`date_trunc('day', ${emailMessages.processedAt} AT TIME ZONE 'UTC')`,
      emailMessages.direction,
    )
    .orderBy(sql`date_trunc('day', ${emailMessages.processedAt} AT TIME ZONE 'UTC')`);

  const byDate = new Map<string, MessageVolumePoint>();

  for (const row of rows) {
    const point = byDate.get(row.date) ?? { date: row.date, inbound: 0, outbound: 0 };
    if (row.direction === "inbound") {
      point.inbound = row.count;
    } else if (row.direction === "outbound") {
      point.outbound = row.count;
    }
    byDate.set(row.date, point);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
