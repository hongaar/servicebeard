import type { AppUser } from "./loaderTypes";

export function isPlatformAdminTeamAccess(
  user: Pick<AppUser, "isAdmin">,
  membership: { id: string } | undefined,
): boolean {
  return !membership && user.isAdmin;
}
