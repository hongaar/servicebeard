import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/root.tsx";
import {
  loginRoute,
  dashboardRoute,
  teamRoute,
  projectsRoute,
  projectDetailRoute,
} from "./routes/index";

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  teamRoute,
  projectsRoute,
  projectDetailRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
