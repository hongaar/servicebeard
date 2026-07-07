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

  function persistProjectSyncError(
    service: string,
    operation: string,
    err: unknown,
    context?: Record<string, unknown>,
    options?: ExternalErrorOptions,
  ): void {
    const projectId = projectIdFromContext(context);
    if (!projectId) return;

    const providerError = providerErrorDetails(err);
    if (providerError?.status === 404 && isQuietProvider404(operation)) return;

    const severity =
      options?.severity ?? classifySyncFailureSeverity(operation);

    void persistEvent({
      projectId,
      service,
      operation,
      message: syncErrorMessage(service, operation, err),
      severity,
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

  function notifyExternalError(
    err: unknown,
    info: SyncEventRecorderContext,
  ): void {
    onExternalError?.(err, info);
  }

  function logExternalError(
    service: string,
    operation: string,
    err: unknown,
    context?: Record<string, unknown>,
    options?: ExternalErrorOptions,
  ): void {
    const providerError = providerErrorDetails(err);
    const severity =
      options?.severity ?? classifySyncFailureSeverity(operation);
    const recorderContext: SyncEventRecorderContext = {
      service,
      operation,
      severity,
      providerError,
      context,
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
          ...context,
        },
        "external service error",
      );
      if (providerError.status !== 404 || !isQuietProvider404(operation)) {
        persistProjectSyncError(service, operation, err, context, options);
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
        ...context,
      },
      "external service error",
    );
    persistProjectSyncError(service, operation, err, context, options);
    notifyExternalError(err, recorderContext);
  }

  function recordSyncStatusEvent(input: {
    projectId: string;
    service: string;
    operation: string;
    message: string;
    severity: ProjectStatusSeverity;
    metadata?: Record<string, unknown>;
  }): void {
    void persistEvent({
      projectId: input.projectId,
      service: input.service,
      operation: input.operation,
      message: input.message,
      severity: input.severity,
      metadata: input.metadata,
    }).catch((persistErr) => {
      logger.warn(
        {
          persistErr,
          projectId: input.projectId,
          service: input.service,
          operation: input.operation,
        },
        "failed to record project sync status event",
      );
    });
  }

  return {
    logExternalError,
    recordSyncStatusEvent,
    syncErrorMessage,
  };
}

export type SyncEventRecorder = ReturnType<typeof createSyncEventRecorder>;
