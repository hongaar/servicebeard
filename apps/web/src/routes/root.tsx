import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { BugsinkUserSync } from "../components/BugsinkUserSync";
import { RouteError } from "../components/RouteError";
import { APP_NAME } from "../lib/documentTitle";

export const rootRoute = createRootRoute({
  head: () => ({
    meta: [{ title: APP_NAME }],
  }),
  component: () => (
    <>
      <HeadContent />
      <BugsinkUserSync />
      <Outlet />
    </>
  ),
  errorComponent: RouteError,
});
