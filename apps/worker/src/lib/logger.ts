import { loadMonorepoEnv } from "@servicebeard/shared/env";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";

loadMonorepoEnv();

const level = process.env.LOG_LEVEL ?? "info";
const isDev = process.env.NODE_ENV === "development";
const logDir = join(import.meta.dir, "../../../../.logs");
const logFile = join(logDir, "worker.log");

if (isDev) {
  mkdirSync(logDir, { recursive: true });
}

export const logger = pino({
  level,
  transport: isDev
    ? {
        targets: [
          { target: "pino-pretty", options: { colorize: true }, level },
          {
            target: "pino/file",
            options: { destination: logFile, append: true, mkdir: true },
            level,
          },
        ],
      }
    : undefined,
});

logger.info({ level, logFile: isDev ? logFile : null }, "logger initialized");
