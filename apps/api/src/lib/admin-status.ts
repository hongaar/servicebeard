import { getDb } from "@servicebeard/db";
import { connect } from "node:net";
import { sql } from "drizzle-orm";
import { getBoss } from "./queue";

const CHECK_TIMEOUT_MS = 5000;

export type AdminCheckCategory = "service" | "mail" | "git";

export interface AdminCheckResult {
  id: string;
  label: string;
  category: AdminCheckCategory;
  ok: boolean;
  latencyMs?: number;
  detail?: string;
  error?: string;
}

export interface AdminStatusResponse {
  ok: boolean;
  checkedAt: string;
  checks: AdminCheckResult[];
}

type CheckDefinition = {
  id: string;
  label: string;
  category: AdminCheckCategory;
  run: () => Promise<Omit<AdminCheckResult, "id" | "label" | "category">>;
};

function testTcp(
  host: string,
  port: number,
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = connect({ host, port, timeout: timeoutMs });

    const finish = (result: { ok: boolean; latencyMs?: number; error?: string }) => {
      socket.removeAllListeners();
      if (!socket.destroyed) socket.destroy();
      resolve(result);
    };

    socket.once("connect", () => {
      finish({ ok: true, latencyMs: Date.now() - start });
    });
    socket.once("error", (err) => {
      finish({ ok: false, error: err.message });
    });
    socket.once("timeout", () => {
      finish({ ok: false, error: "timeout" });
    });
  });
}

async function testHttp(
  url: string,
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<{ ok: boolean; latencyMs?: number; detail?: string; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    const latencyMs = Date.now() - start;
    const ok = response.status < 500;
    return {
      ok,
      latencyMs,
      detail: `HTTP ${response.status}`,
      ...(ok ? {} : { error: `HTTP ${response.status}` }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck(def: CheckDefinition): Promise<AdminCheckResult> {
  try {
    const result = await def.run();
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      ...result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      ok: false,
      error: message,
    };
  }
}

const CHECKS: CheckDefinition[] = [
  {
    id: "database",
    label: "PostgreSQL",
    category: "service",
    run: async () => {
      const start = Date.now();
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      return { ok: true, latencyMs: Date.now() - start };
    },
  },
  {
    id: "job-queue",
    label: "Job queue (pg-boss)",
    category: "service",
    run: async () => {
      const start = Date.now();
      const boss = await getBoss();
      await boss.getQueueSize("imap-poll");
      return { ok: true, latencyMs: Date.now() - start };
    },
  },
  {
    id: "smtp-submission",
    label: "SMTP submission (smtp.gmail.com:587)",
    category: "mail",
    run: async () => {
      const result = await testTcp("smtp.gmail.com", 587);
      return { ...result, detail: "Outbound SMTP STARTTLS" };
    },
  },
  {
    id: "smtp-smtps",
    label: "SMTPS (smtp.gmail.com:465)",
    category: "mail",
    run: async () => {
      const result = await testTcp("smtp.gmail.com", 465);
      return { ...result, detail: "Outbound SMTP over TLS" };
    },
  },
  {
    id: "imap-imaps",
    label: "IMAPS (imap.gmail.com:993)",
    category: "mail",
    run: async () => {
      const result = await testTcp("imap.gmail.com", 993);
      return { ...result, detail: "Inbound IMAP over TLS" };
    },
  },
  {
    id: "imap-plain",
    label: "IMAP (imap.gmail.com:143)",
    category: "mail",
    run: async () => {
      const result = await testTcp("imap.gmail.com", 143);
      return { ...result, detail: "Inbound IMAP (often blocked externally)" };
    },
  },
  {
    id: "github-api",
    label: "GitHub API (api.github.com)",
    category: "git",
    run: async () => testHttp("https://api.github.com"),
  },
  {
    id: "gitlab-api",
    label: "GitLab API (gitlab.com)",
    category: "git",
    run: async () => testHttp("https://gitlab.com/api/v4/version"),
  },
];

let lastStatus: AdminStatusResponse | null = null;

export function getLastAdminStatus(): AdminStatusResponse | null {
  return lastStatus;
}

export async function runAdminStatusChecks(): Promise<AdminStatusResponse> {
  const checks = await Promise.all(CHECKS.map(runCheck));
  lastStatus = {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    checks,
  };
  return lastStatus;
}
