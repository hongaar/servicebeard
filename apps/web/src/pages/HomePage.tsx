import { useLoaderData } from "@tanstack/react-router";
import { LandingPage } from "../landing";
import { DashboardPage } from "./DashboardPage";

export function HomePage() {
  const data = useLoaderData({ from: "/" });

  if (!data.user) {
    return <LandingPage variant="app" showSignIn />;
  }

  return <DashboardPage />;
}
