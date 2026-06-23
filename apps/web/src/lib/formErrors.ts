import { ApiError } from "./api";

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function handleMutationError(
  err: unknown,
  setFormError: (message: string) => void,
  setFieldErrors: (errors: Record<string, string>) => void,
): void {
  if (err instanceof ApiError) {
    setFormError(err.message);
    setFieldErrors(err.fieldErrors);
    return;
  }
  setFormError(err instanceof Error ? err.message : "Request failed");
  setFieldErrors({});
}

export function clearFieldError(
  fieldErrors: Record<string, string>,
  field: string,
): Record<string, string> {
  if (!fieldErrors[field]) return fieldErrors;
  const next = { ...fieldErrors };
  delete next[field];
  return next;
}
