import { logger } from "./logger";

interface GuardState {
  running: boolean;
}

const globalGuards = globalThis as typeof globalThis & {
  __servicebeardRunGuards?: Map<string, GuardState>;
};

function getGuard(name: string): GuardState {
  if (!globalGuards.__servicebeardRunGuards) {
    globalGuards.__servicebeardRunGuards = new Map();
  }
  let guard = globalGuards.__servicebeardRunGuards.get(name);
  if (!guard) {
    guard = { running: false };
    globalGuards.__servicebeardRunGuards.set(name, guard);
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
