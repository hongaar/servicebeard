import { createRouter } from "@tanstack/react-router";
import {
    dashboardRoute,
    loginRoute,
    projectRedirectRoute,
    projectSectionRoute,
    projectsRoute,
    teamMembersRoute,
    teamRedirectRoute,
} from "./routes/index";
import { rootRoute } from "./routes/root.tsx";

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  teamRedirectRoute,
  teamMembersRoute,
  projectsRoute,
  projectRedirectRoute,
  projectSectionRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
