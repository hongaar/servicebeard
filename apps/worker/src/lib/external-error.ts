import { recordProjectStatusEvent } from "@servicebeard/db";
import { providerErrorDetails } from "@servicebeard/providers";
import {
  createSyncEventRecorder,
  type ExternalErrorOptions,
} from "@servicebeard/shared";
import { captureBugsinkError } from "./bugsink";
import { logger } from "./logger";

const syncEvents = createSyncEventRecorder({
  logger,
  persistEvent: recordProjectStatusEvent,
  providerErrorDetails,
  onExternalError: (
    err,
    { service, operation, severity, providerError, context },
  ) => {
    captureBugsinkError(err, {
      extra: {
        operation,
        externalService: service,
        ...(providerError
          ? {
              provider: providerError.name,
              providerStatus: providerError.status,
            }
          : {}),
        severity,
        ...context,
      },
    });
  },
});

export const { logExternalError, recordSyncStatusEvent } = syncEvents;

export type { ExternalErrorOptions };

export async function withExternalErrorLogging<T>(
  service: string,
  operation: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>,
  options?: ExternalErrorOptions,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logExternalError(service, operation, err, context, options);
    throw err;
  }
}
