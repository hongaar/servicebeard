import type { TeamEntitlementUsage } from "@servicebeard/shared/entitlements";

export type LimitResource = "project" | "rule";

export interface LimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: LimitResource;
  entitlements: TeamEntitlementUsage;
  teamId: string;
}
