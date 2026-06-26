import { providerErrorDetails, setProviderLog } from "@servicebeard/providers";
import { formatValidationError } from "@servicebeard/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { loadExtensions } from "./extensions";
import { setEntitlementsProvider } from "./lib/entitlements";
import "./lib/env-loader";
import { logExternalError } from "./lib/external-error";
import { logger } from "./lib/logger";
import { seedDevLocalAccount } from "./lib/login/dev-account";
import { httpRequestDuration, httpRequestTotal } from "./lib/metrics";
import type { AppVariables } from "./middleware/auth";
import { authMiddleware } from "./middleware/auth";
import { requestLogMiddleware } from "./middleware/request-log";
import { authRoutes } from "./routes/auth";
import { githubAppRoutes } from "./routes/github-app";
import { healthRoutes } from "./routes/health";
import { projectRoutes } from "./routes/projects";
import { teamRoutes } from "./routes/teams";
import { webhookRoutes } from "./routes/webhooks";

const app = new Hono<{ Variables: AppVariables }>();

setProviderLog((level, message, context) => {
  logger[level](context ?? {}, message);
});

app.use("*", cors({
    origin: process.env.WEB_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = (Date.now() - start) / 1000;
  const route = c.req.path;
  const status = String(c.res.status);
  httpRequestDuration.observe(
    { method: c.req.method, route, status },
    duration,
  );
  httpRequestTotal.inc({ method: c.req.method, route, status });
});

app.use("*", requestLogMiddleware);

app.use("*", authMiddleware);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(formatValidationError(err), 400);
  }
  if (err.message === "UNAUTHORIZED") {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (err.message === "FORBIDDEN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (err.message === "PROJECT_LIMIT_REACHED") {
    return c.json({ error: "Project limit reached", code: "PROJECT_LIMIT_REACHED" }, 402);
  }
  if (err.message === "RULE_LIMIT_REACHED") {
    return c.json({ error: "Rule limit reached", code: "RULE_LIMIT_REACHED" }, 402);
  }
  if (err.message === "CONVERSATION_LIMIT_REACHED") {
    return c.json(
      { error: "Monthly conversation limit reached", code: "CONVERSATION_LIMIT_REACHED" },
      402,
    );
  }
  if (err.message === "SUBSCRIPTION_REQUIRED") {
    return c.json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" }, 402);
  }
  if (err.message === "LOGIN_PROVIDER_DISABLED") {
    return c.json({ error: "Not available" }, 404);
  }
  if (err.message === "SIGNUP_DISABLED") {
    return c.json({ error: "Sign-up is disabled for this provider" }, 403);
  }
  if (err.message === "INVALID_CREDENTIALS") {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  if (err.message === "EMAIL_TAKEN") {
    return c.json({ error: "An account with this email already exists" }, 409);
  }
  const providerError = providerErrorDetails(err);
  if (providerError) {
    logExternalError("api", "unhandled", err);
    return c.json(
      {
        error: providerError.message,
        status: providerError.status,
        responseBody: providerError.responseBody,
      },
      500,
    );
  }
  logger.error(
    {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
    "unhandled error",
  );
  const message = err instanceof Error ? err.message : "Internal server error";
  return c.json({ error: message }, 500);
});

app.route("/", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/github-app", githubAppRoutes);
app.route("/api/teams", teamRoutes);
app.route("/api/teams", projectRoutes);
app.route("/webhooks", webhookRoutes);

await loadExtensions({ app, setEntitlementsProvider });

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};

logger.info({ port }, "API server starting");

seedDevLocalAccount().catch((err) => {
  logger.error({ err }, "dev account seed failed");
});
