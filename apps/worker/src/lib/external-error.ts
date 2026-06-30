import { recordProjectStatusEvent } from "@servicebeard/db";
import { providerErrorDetails } from "@servicebeard/providers";
import { captureBugsinkError } from "./bugsink";
import { logger } from "./logger";

function projectIdFromContext(
  context?: Record<string, unknown>,
): string | undefined {
  return typeof context?.projectId === "string" ? context.projectId : undefined;
}

function persistProjectSyncError(
  service: string,
  operation: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const projectId = projectIdFromContext(context);
  if (!projectId) return;

  const providerError = providerErrorDetails(err);
  if (providerError?.status === 404) return;

  void recordProjectStatusEvent({
    projectId,
    service,
    operation,
    message:
      providerError?.message ??
      (err instanceof Error ? err.message : String(err)),
    status: providerError?.status,
    responseBody: providerError?.responseBody,
    metadata: context,
  }).catch((persistErr) => {
    logger.warn(
      { persistErr, projectId, service, operation },
      "failed to record project sync error",
    );
  });
}

export function logExternalError(
  service: string,
  operation: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const providerError = providerErrorDetails(err);
  if (providerError) {
    const level = providerError.status === 404 ? "debug" : "error";
    logger[level](
      {
        service,
        operation,
        provider: providerError.name,
        status: providerError.status,
        message: providerError.message,
        responseBody: providerError.responseBody,
        ...context,
      },
      "external service error",
    );
    if (providerError.status !== 404) {
      persistProjectSyncError(service, operation, err, context);
      captureBugsinkError(err, {
        extra: {
          operation,
          externalService: service,
          provider: providerError.name,
          providerStatus: providerError.status,
          ...context,
        },
      });
    }
    return;
  }

  logger.error(
    {
      service,
      operation,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ...context,
    },
    "external service error",
  );
  persistProjectSyncError(service, operation, err, context);
  captureBugsinkError(err, {
    extra: {
      operation,
      externalService: service,
      ...context,
    },
  });
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
