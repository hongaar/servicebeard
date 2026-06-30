import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type MessageVolumePoint } from "../lib/api";
import styles from "../styles/pages.module.css";
import { Select } from "./Input";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "365", label: "Last year" },
] as const;

type RangeDays = (typeof RANGE_OPTIONS)[number]["value"];

function buildDailySeries(
  points: MessageVolumePoint[],
  days: number,
): MessageVolumePoint[] {
  const byDate = new Map(points.map((point) => [point.date, point]));
  const series: MessageVolumePoint[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));

  for (let i = 0; i < days; i++) {
    const date = cursor.toISOString().slice(0, 10);
    series.push(byDate.get(date) ?? { date, inbound: 0, outbound: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

function formatAxisDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (days <= 7) {
    return parsed.toLocaleDateString(undefined, { weekday: "short" });
  }
  if (days <= 30) {
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  return parsed.toLocaleDateString(undefined, { month: "short" });
}

interface ConversationVolumeChartProps {
  teamId: string;
  projectId: string;
}

export function ConversationVolumeChart({
  teamId,
  projectId,
}: ConversationVolumeChartProps) {
  const [range, setRange] = useState<RangeDays>("30");
  const days = Number(range) as 7 | 30 | 365;

  const volumeQuery = useQuery({
    queryKey: ["message-volume", teamId, projectId, days],
    queryFn: () => api.getMessageVolume(teamId, projectId, days),
  });

  const series = buildDailySeries(volumeQuery.data?.points ?? [], days);
  const maxTotal = Math.max(
    ...series.map((point) => point.inbound + point.outbound),
    1,
  );
  const labelStride = days <= 7 ? 1 : days <= 30 ? 5 : 30;

  return (
    <div className={styles.volumeChart}>
      <div className={styles.volumeChartHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Conversation volume</h2>
          <p className={styles.sectionDescription}>
            Incoming and outgoing messages per day.
          </p>
        </div>
        <div className={styles.volumeChartFilter}>
          <Select
            label="Range"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeDays)}
            options={[...RANGE_OPTIONS]}
          />
        </div>
      </div>

      <div className={styles.volumeLegend}>
        <span className={styles.volumeLegendItem}>
          <span
            className={[styles.volumeLegendSwatch, styles.volumeInbound].join(
              " ",
            )}
          />
          Incoming
        </span>
        <span className={styles.volumeLegendItem}>
          <span
            className={[styles.volumeLegendSwatch, styles.volumeOutbound].join(
              " ",
            )}
          />
          Outgoing
        </span>
      </div>

      {volumeQuery.isLoading ? (
        <p className={styles.formHint}>Loading chart…</p>
      ) : volumeQuery.isError ? (
        <p className={styles.testError}>Could not load conversation volume.</p>
      ) : (
        <div
          className={styles.volumePlot}
          role="img"
          aria-label="Conversation volume chart"
        >
          <div className={styles.volumeBars}>
            {series.map((point) => {
              const total = point.inbound + point.outbound;
              const heightPct = total === 0 ? 0 : (total / maxTotal) * 100;
              const inboundPct =
                total === 0 ? 0 : (point.inbound / total) * 100;
              return (
                <div key={point.date} className={styles.volumeBarGroup}>
                  <div
                    className={styles.volumeBar}
                    style={{ height: `${heightPct}%` }}
                    title={`${point.date}: ${point.inbound} incoming, ${point.outbound} outgoing`}
                  >
                    {total > 0 && (
                      <>
                        <span
                          className={styles.volumeInbound}
                          style={{ height: `${inboundPct}%` }}
                        />
                        <span
                          className={styles.volumeOutbound}
                          style={{ height: `${100 - inboundPct}%` }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.volumeAxis}>
            {series.map((point, index) => (
              <span key={point.date} className={styles.volumeAxisLabel}>
                {index % labelStride === 0 || index === series.length - 1
                  ? formatAxisDate(point.date, days)
                  : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
