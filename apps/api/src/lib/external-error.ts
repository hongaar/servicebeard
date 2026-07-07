import { recordProjectStatusEvent } from "@servicebeard/db";
import { providerErrorDetails } from "@servicebeard/providers";
import { createSyncEventRecorder } from "@servicebeard/shared";
import { logger } from "./logger";

const syncEvents = createSyncEventRecorder({
  logger,
  persistEvent: recordProjectStatusEvent,
  providerErrorDetails,
});

export const { recordProjectSyncEvent, logExternalError } = syncEvents;

export type { ExternalErrorOptions } from "@servicebeard/shared";

export function providerFailureResponse(
  operation: string,
  err: unknown,
  context?: { projectId?: string },
): {
  ok: false;
  error: string;
  status?: number;
  responseBody?: string;
} {
  logExternalError("api", operation, err, context);
  const details = providerErrorDetails(err);
  return {
    ok: false,
    error: syncEvents.syncErrorMessage("api", operation, err),
    status: details?.status,
    responseBody: details?.responseBody,
  };
}
