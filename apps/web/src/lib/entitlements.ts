import type { TeamEntitlementUsage } from "@servicebeard/shared/entitlements";

export type { TeamEntitlementUsage };

export function canCreateWithinLimit(
  used: number,
  limit: number | null | undefined,
): boolean {
  if (limit == null) return true;
  return used < limit;
}

export function entitlementLimitMessage(
  resource: "project" | "rule",
  entitlements: TeamEntitlementUsage | null | undefined,
): string | null {
  if (!entitlements) return null;
  if (entitlements.subscriptionRequired && resource === "project") {
    return "Subscription required";
  }
  const usage = resource === "project" ? entitlements.projects : entitlements.rules;
  if (canCreateWithinLimit(usage.used, usage.limit)) return null;
  return resource === "project" ? "Project limit reached" : "Rule limit reached";
}
