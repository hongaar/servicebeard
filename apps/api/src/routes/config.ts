import { getBlockedMailPortsConfig } from "@servicebeard/shared";
import { Hono } from "hono";

const configRoutes = new Hono();

configRoutes.get("/config", (c) => {
  return c.json(getBlockedMailPortsConfig());
});

export { configRoutes };
