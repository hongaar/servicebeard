import { ZodError, type ZodIssue } from "zod";

export interface ValidationErrorResponse {
  error: string;
  fieldErrors: Record<string, string>;
}

function issueToFieldKey(issue: ZodIssue): string {
  return issue.path.map(String).join(".");
}

export function zodErrorToFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issueToFieldKey(issue);
    if (!key || fieldErrors[key]) continue;
    fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export function formatValidationError(
  error: ZodError,
): ValidationErrorResponse {
  const fieldErrors = zodErrorToFieldErrors(error);
  const first = error.issues[0]?.message;
  return {
    error: first ? `Validation failed: ${first}` : "Validation failed",
    fieldErrors,
  };
}

/** Drop empty strings from PATCH bodies so optional secret fields are omitted. */
export function stripEmptyStrings(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ""));
}
