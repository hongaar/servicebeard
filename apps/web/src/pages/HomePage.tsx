import { ExtensionLanding } from "@extensions";
import { useLoaderData } from "@tanstack/react-router";
import { DashboardPage } from "./DashboardPage";

export function HomePage() {
  const data = useLoaderData({ from: "/" });

  if (data.landing && ExtensionLanding) {
    return <ExtensionLanding />;
  }

  return <DashboardPage />;
}
