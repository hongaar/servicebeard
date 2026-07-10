const CLOSED_PROVIDER_STATUSES = new Set(["closed", "Closed"]);

export function isClosedProviderStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return CLOSED_PROVIDER_STATUSES.has(status);
}

/** Target status when reopening a closed issue after a customer reply. */
export function resolveReopenStatus(
  ruleActionStatus: string | null | undefined,
  defaultOpenStatus: string,
): string {
  if (ruleActionStatus && !isClosedProviderStatus(ruleActionStatus)) {
    return ruleActionStatus;
  }
  return defaultOpenStatus;
}
