import { GitLabApiError } from "@serviceboard/providers";
import { logger } from "./logger";

export function logExternalError(
  service: string,
  operation: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (err instanceof GitLabApiError) {
    const level = err.status === 404 ? "debug" : "error";
    logger[level](
      {
        service,
        operation,
        status: err.status,
        err,
        ...context,
      },
      "external service error",
    );
    return;
  }

  logger.error(
    {
      service,
      operation,
      err,
      ...context,
    },
    "external service error",
  );
}

export async function withExternalErrorLogging<T>(
  service: string,
  operation: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logExternalError(service, operation, err, context);
    throw err;
  }
}
