import { loadMonorepoEnv } from "@serviceboard/shared/env";
import pino from "pino";

loadMonorepoEnv();

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

logger.debug({ level }, "logger initialized");
