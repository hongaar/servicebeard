export class ProviderApiError extends Error {
  readonly status: number;
  readonly responseBody?: string;

  constructor(
    status: number,
    message: string,
    name = "ProviderApiError",
    responseBody?: string,
  ) {
    super(message);
    this.name = name;
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function providerErrorDetails(
  err: unknown,
): { status: number; message: string; name: string; responseBody?: string } | null {
  if (!(err instanceof ProviderApiError)) return null;
  return {
    status: err.status,
    message: err.message,
    name: err.name,
    responseBody: err.responseBody,
  };
}
