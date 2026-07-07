import { recordProjectStatusEvent } from "@servicebeard/db";
import { providerErrorDetails } from "@servicebeard/providers";
import { createSyncEventRecorder } from "@servicebeard/shared";
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

export const { recordProjectSyncEvent, logExternalError } = syncEvents;
