import { createRootRoute, Outlet } from "@tanstack/react-router";
import { BugsinkUserSync } from "../components/BugsinkUserSync";
import { RouteError } from "../components/RouteError";

export const rootRoute = createRootRoute({
  component: () => (
    <>
      <BugsinkUserSync />
      <Outlet />
    </>
  ),
  errorComponent: RouteError,
});
