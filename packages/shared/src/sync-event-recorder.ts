import {
  classifySyncFailureSeverity,
  isQuietProvider404,
  type ProjectStatusSeverity,
} from "./constants";
import { humanizeSyncErrorMessage } from "./sync-error-messages";

export interface SyncEventLog {
  debug(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

export interface ProviderErrorDetails {
  status: number;
  message: string;
  name: string;
  responseBody?: string;
}

export interface RecordProjectStatusEventInput {
  projectId: string;
  service: string;
  operation: string;
  message: string;
  status?: number;
  responseBody?: string;
  metadata?: Record<string, unknown>;
  severity?: ProjectStatusSeverity;
}

export interface ExternalErrorOptions {
  severity?: Extract<ProjectStatusSeverity, "error" | "warning">;
}

export interface SyncEventRecorderContext {
  service: string;
  operation: string;
  severity: Extract<ProjectStatusSeverity, "error" | "warning">;
  providerError: ProviderErrorDetails | null;
  context?: Record<string, unknown>;
}

export interface SyncEventRecorderDeps {
  logger: SyncEventLog;
  persistEvent: (input: RecordProjectStatusEventInput) => Promise<void>;
  providerErrorDetails: (err: unknown) => ProviderErrorDetails | null;
  onExternalError?: (err: unknown, info: SyncEventRecorderContext) => void;
}

type ProjectSyncEventBase = {
  service: string;
  operation: string;
  metadata?: Record<string, unknown>;
};

export type RecordProjectSyncEventInput = ProjectSyncEventBase &
  (
    | {
        severity: "error" | "warning";
        err: unknown;
        projectId?: string;
      }
    | {
        severity: "info" | "success";
        projectId: string;
        message: string;
      }
  );

function logLevelForSeverity(
  severity: Extract<ProjectStatusSeverity, "error" | "warning">,
): "error" | "warn" {
  return severity === "warning" ? "warn" : "error";
}

function projectIdFromContext(
  context?: Record<string, unknown>,
): string | undefined {
  return typeof context?.projectId === "string" ? context.projectId : undefined;
}

export function createSyncEventRecorder(deps: SyncEventRecorderDeps) {
  const { logger, persistEvent, providerErrorDetails, onExternalError } = deps;

  function syncErrorMessage(
    service: string,
    operation: string,
    err: unknown,
  ): string {
    const providerError = providerErrorDetails(err);
    if (providerError) return providerError.message;
    return humanizeSyncErrorMessage(service, operation, err);
  }

  function persistEventFireAndForget(
    input: RecordProjectStatusEventInput,
    logContext: { service: string; operation: string },
  ): void {
    void persistEvent(input).catch((persistErr) => {
      logger.warn(
        {
          persistErr,
          projectId: input.projectId,
          service: logContext.service,
          operation: logContext.operation,
        },
        "failed to record project sync event",
      );
    });
  }

  function persistFailureEvent(
    service: string,
    operation: string,
    err: unknown,
    projectId: string,
    severity: Extract<ProjectStatusSeverity, "error" | "warning">,
    metadata?: Record<string, unknown>,
  ): void {
    const providerError = providerErrorDetails(err);
    if (providerError?.status === 404 && isQuietProvider404(operation)) return;

    persistEventFireAndForget(
      {
        projectId,
        service,
        operation,
        message: syncErrorMessage(service, operation, err),
        severity,
        status: providerError?.status,
        responseBody: providerError?.responseBody,
        metadata,
      },
      { service, operation },
    );
  }

  function notifyExternalError(
    err: unknown,
    info: SyncEventRecorderContext,
  ): void {
    onExternalError?.(err, info);
  }

  function recordFailureEvent(input: {
    service: string;
    operation: string;
    err: unknown;
    projectId?: string;
    metadata?: Record<string, unknown>;
    severity?: Extract<ProjectStatusSeverity, "error" | "warning">;
  }): void {
    const { service, operation, err, metadata } = input;
    const providerError = providerErrorDetails(err);
    const severity = input.severity ?? classifySyncFailureSeverity(operation);
    const recorderContext: SyncEventRecorderContext = {
      service,
      operation,
      severity,
      providerError,
      context: metadata,
    };

    if (providerError) {
      const level =
        providerError.status === 404 && isQuietProvider404(operation)
          ? "debug"
          : logLevelForSeverity(severity);
      logger[level](
        {
          service,
          operation,
          provider: providerError.name,
          status: providerError.status,
          message: providerError.message,
          responseBody: providerError.responseBody,
          severity,
          ...metadata,
        },
        "external service error",
      );
      if (providerError.status !== 404 || !isQuietProvider404(operation)) {
        if (input.projectId) {
          persistFailureEvent(
            service,
            operation,
            err,
            input.projectId,
            severity,
            metadata,
          );
        }
        notifyExternalError(err, recorderContext);
      }
      return;
    }

    logger[logLevelForSeverity(severity)](
      {
        service,
        operation,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        severity,
        ...metadata,
      },
      "external service error",
    );
    if (input.projectId) {
      persistFailureEvent(
        service,
        operation,
        err,
        input.projectId,
        severity,
        metadata,
      );
    }
    notifyExternalError(err, recorderContext);
  }

  function isFailureSyncEvent(
    input: RecordProjectSyncEventInput,
  ): input is ProjectSyncEventBase & {
    severity: "error" | "warning";
    err: unknown;
    projectId?: string;
  } {
    return input.severity === "error" || input.severity === "warning";
  }

  function recordProjectSyncEvent(input: RecordProjectSyncEventInput): void {
    if (isFailureSyncEvent(input)) {
      recordFailureEvent(input);
      return;
    }

    persistEventFireAndForget(
      {
        projectId: input.projectId,
        service: input.service,
        operation: input.operation,
        message: input.message,
        severity: input.severity,
        metadata: input.metadata,
      },
      { service: input.service, operation: input.operation },
    );
  }

  function logExternalError(
    service: string,
    operation: string,
    err: unknown,
    context?: Record<string, unknown>,
    options?: ExternalErrorOptions,
  ): void {
    recordFailureEvent({
      service,
      operation,
      err,
      projectId: projectIdFromContext(context),
      metadata: context,
      severity: options?.severity,
    });
  }

  return {
    recordProjectSyncEvent,
    logExternalError,
    syncErrorMessage,
  };
}

export type SyncEventRecorder = ReturnType<typeof createSyncEventRecorder>;
