import { createRootRoute, Outlet } from "@tanstack/react-router";
import { RouteError } from "../components/RouteError";

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
  errorComponent: RouteError,
});
