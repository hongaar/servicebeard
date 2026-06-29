import { globalSearch } from "@servicebeard/db";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

const searchRoutes = new Hono<{ Variables: AppVariables }>();

searchRoutes.get("/", async (c) => {
  const user = requireAuth(c);
  const parsed = searchQuerySchema.parse({
    q: c.req.query("q") ?? "",
    limit: c.req.query("limit"),
  });

  const results = await globalSearch(user.id, parsed.q, parsed.limit);
  return c.json(results);
});

export { searchRoutes };
