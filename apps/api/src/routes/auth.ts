import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
    auditLog,
    completeProviderLogin,
    credentialProviderLogin,
    destroySession,
    getPublicLoginConfig,
    getSessionCookieName,
    passkeyAuthenticationOptions,
    passkeyAuthenticationVerify,
    passkeyRegistrationOptions,
    passkeyRegistrationVerify,
    startProviderLogin,
} from "../lib/auth";
import type { AppVariables } from "../middleware/auth";

const authRoutes = new Hono<{ Variables: AppVariables }>();

function setSessionCookie(c: Context, token: string) {
  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

function mapAuthError(err: unknown) {
  if (!(err instanceof Error)) {
    return { status: 400 as const, message: "Login failed" };
  }

  switch (err.message) {
    case "LOGIN_PROVIDER_DISABLED":
      return { status: 404 as const, message: "Not available" };
    case "SIGNUP_DISABLED":
      return { status: 403 as const, message: "Sign-up is disabled for this provider" };
    case "INVALID_CREDENTIALS":
      return { status: 401 as const, message: "Invalid email or password" };
    case "EMAIL_TAKEN":
      return { status: 409 as const, message: "An account with this email already exists" };
    case "WEBAUTHN_CHALLENGE_EXPIRED":
    case "WEBAUTHN_VERIFICATION_FAILED":
      return { status: 400 as const, message: "Passkey verification failed" };
    default:
      return { status: 400 as const, message: "Login failed" };
  }
}

authRoutes.get("/config", (c) => {
  return c.json({ providers: getPublicLoginConfig() });
});

authRoutes.get("/login/:provider", async (c) => {
  const provider = c.req.param("provider");

  try {
    const { redirectUrl, state, codeVerifier } = await startProviderLogin(provider);
    setCookie(c, "sd_oauth_state", `${state}|${codeVerifier}|${provider}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 600,
      path: "/",
    });
    return c.redirect(redirectUrl);
  } catch {
    return c.json({ error: "Login provider not available" }, 404);
  }
});

authRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthCookie = c.req.header("cookie")?.match(/sd_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || !oauthCookie) {
    return c.json({ error: "Invalid callback" }, 400);
  }

  const [storedState, codeVerifier, provider] =
    decodeURIComponent(oauthCookie).split("|");
  if (!storedState || !codeVerifier || !provider || storedState !== state) {
    return c.json({ error: "State mismatch" }, 400);
  }

  try {
    const { token, user } = await completeProviderLogin(provider, {
      code,
      codeVerifier,
    });

    setSessionCookie(c, token);
    deleteCookie(c, "sd_oauth_state");

    await auditLog({
      userId: user.id,
      action: "login",
      resourceType: "user",
      resourceId: user.id,
      metadata: { provider },
    });

    const webUrl = process.env.WEB_URL ?? "http://localhost:5173";
    return c.redirect(webUrl);
  } catch {
    return c.json({ error: "Login failed" }, 400);
  }
});

authRoutes.post("/login/:provider", async (c) => {
  const provider = c.req.param("provider");
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;
  const mode = body.mode === "signup" ? "signup" : "login";

  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  try {
    const { token, user } = await credentialProviderLogin(provider, {
      email,
      password,
      name,
      mode,
    });
    setSessionCookie(c, token);

    await auditLog({
      userId: user.id,
      action: mode === "signup" ? "signup" : "login",
      resourceType: "user",
      resourceId: user.id,
      metadata: { provider, method: "password" },
    });

    return c.json({ user });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message }, mapped.status);
  }
});

authRoutes.post("/login/:provider/passkey/register/options", async (c) => {
  const provider = c.req.param("provider");
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;

  if (!email || !name) {
    return c.json({ error: "Email and name are required" }, 400);
  }

  try {
    const options = await passkeyRegistrationOptions(provider, { email, name });
    return c.json(options);
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message }, mapped.status);
  }
});

authRoutes.post("/login/:provider/passkey/register/verify", async (c) => {
  const provider = c.req.param("provider");
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;
  const response = body.response;

  if (!email || !name || !response) {
    return c.json({ error: "Invalid passkey registration" }, 400);
  }

  try {
    const { token, user } = await passkeyRegistrationVerify(provider, {
      email,
      name,
      response,
    });
    setSessionCookie(c, token);

    await auditLog({
      userId: user.id,
      action: "signup",
      resourceType: "user",
      resourceId: user.id,
      metadata: { provider, method: "passkey" },
    });

    return c.json({ user });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message }, mapped.status);
  }
});

authRoutes.post("/login/:provider/passkey/authenticate/options", async (c) => {
  const provider = c.req.param("provider");

  try {
    const options = await passkeyAuthenticationOptions(provider);
    return c.json(options);
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message }, mapped.status);
  }
});

authRoutes.post("/login/:provider/passkey/authenticate/verify", async (c) => {
  const provider = c.req.param("provider");
  const body = await c.req.json().catch(() => ({}));
  const response = body.response;

  if (!response) {
    return c.json({ error: "Invalid passkey authentication" }, 400);
  }

  try {
    const { token, user } = await passkeyAuthenticationVerify(provider, response);
    setSessionCookie(c, token);

    await auditLog({
      userId: user.id,
      action: "login",
      resourceType: "user",
      resourceId: user.id,
      metadata: { provider, method: "passkey" },
    });

    return c.json({ user });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message }, mapped.status);
  }
});

authRoutes.get("/me", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ user: null });
  return c.json({ user });
});

authRoutes.post("/logout", async (c) => {
  const cookie = c.req.header("cookie")?.match(/sd_session=([^;]+)/)?.[1];
  if (cookie) {
    await destroySession(cookie);
    const user = c.get("user");
    if (user) {
      await auditLog({
        userId: user.id,
        action: "logout",
        resourceType: "user",
        resourceId: user.id,
      });
    }
  }
  deleteCookie(c, getSessionCookieName());
  return c.json({ ok: true });
});

export { authRoutes };
