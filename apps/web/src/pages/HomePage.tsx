import { ExtensionLanding } from "@extensions";
import { useLoaderData } from "@tanstack/react-router";
import { DashboardPage } from "./DashboardPage";

export function HomePage() {
  const data = useLoaderData({ from: "/" });

  if (data.landing && ExtensionLanding) {
    return <ExtensionLanding />;
  }

  if (data.landing || !data.user) {
    return null;
  }

  return <DashboardPage user={data.user} teams={data.teams} pendingInvites={data.pendingInvites} />;
}
