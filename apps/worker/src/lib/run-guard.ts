import { logger } from "./logger";

interface GuardState {
  running: boolean;
}

const globalGuards = globalThis as typeof globalThis & {
  __serviceboardRunGuards?: Map<string, GuardState>;
};

function getGuard(name: string): GuardState {
  if (!globalGuards.__serviceboardRunGuards) {
    globalGuards.__serviceboardRunGuards = new Map();
  }
  let guard = globalGuards.__serviceboardRunGuards.get(name);
  if (!guard) {
    guard = { running: false };
    globalGuards.__serviceboardRunGuards.set(name, guard);
  }
  return guard;
}

export async function runExclusive<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const guard = getGuard(name);
  if (guard.running) {
    logger.debug({ name }, "skipped job, previous run still in progress");
    return undefined;
  }

  guard.running = true;
  try {
    return await fn();
  } finally {
    guard.running = false;
  }
}
