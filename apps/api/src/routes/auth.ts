import { getDb, users } from "@servicebeard/db";
import type { LoginProviderType } from "@servicebeard/shared/login";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  auditLog,
  completeProviderIdentity,
  completeProviderLogin,
  countSignInMethods,
  credentialProviderLogin,
  destroySession,
  getLoginAdapter,
  getPublicLoginConfig,
  getSessionCookieName,
  isRedirectProvider,
  linkProviderToUser,
  listLinkedProviders,
  passkeyAuthenticationOptions,
  passkeyAuthenticationVerify,
  passkeyRegistrationOptions,
  passkeyRegistrationVerify,
  startProviderLogin,
  unlinkProviderFromUser,
} from "../lib/auth";
import { logger } from "../lib/logger";
import { isRedirectLoginAdapter } from "../lib/login";
import {
  requestPasswordReset,
  resendEmailVerification,
  resetPasswordWithToken,
  verifyEmailWithToken,
} from "../lib/transactional-mail";
import type { AppVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";

const authRoutes = new Hono<{ Variables: AppVariables }>();

function webUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

function setSessionCookie(c: Context, token: string) {
  setCookie(c, getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

function setOAuthStateCookie(c: Context, value: string) {
  setCookie(c, "sd_oauth_state", value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });
}

function parseOAuthStateCookie(value: string) {
  const parts = value.split("|");
  const [storedState, codeVerifier, provider, mode, linkUserId] = parts;
  if (!storedState || !codeVerifier || !provider) return null;
  return {
    storedState,
    codeVerifier,
    provider,
    linkUserId: mode === "link" && linkUserId ? linkUserId : null,
  };
}

function mapAuthError(err: unknown) {
  if (!(err instanceof Error)) {
    return {
      status: 400 as const,
      message: "Login failed",
      code: "login_failed" as const,
    };
  }

  switch (err.message) {
    case "LOGIN_PROVIDER_DISABLED":
      return {
        status: 404 as const,
        message: "Not available",
        code: "not_available" as const,
      };
    case "SIGNUP_DISABLED":
      return {
        status: 403 as const,
        message: "Sign-up is disabled for this provider",
        code: "signup_disabled" as const,
      };
    case "INVALID_CREDENTIALS":
      return {
        status: 401 as const,
        message: "Invalid email or password",
        code: "invalid_credentials" as const,
      };
    case "EMAIL_TAKEN":
      return {
        status: 409 as const,
        message:
          "An account with this email already exists. Sign in with your existing method, then link this provider from Account settings.",
        code: "email_taken" as const,
      };
    case "PROVIDER_ALREADY_LINKED":
      return {
        status: 409 as const,
        message: "This provider is already linked to an account",
        code: "provider_already_linked" as const,
      };
    case "PROVIDER_NOT_LINKED":
      return {
        status: 404 as const,
        message: "Provider is not linked to your account",
        code: "provider_not_linked" as const,
      };
    case "LAST_AUTH_METHOD":
      return {
        status: 400 as const,
        message: "Cannot remove your only sign-in method",
        code: "last_auth_method" as const,
      };
    case "PROVIDER_LINK_NOT_SUPPORTED":
    case "PROVIDER_UNLINK_NOT_SUPPORTED":
      return {
        status: 400 as const,
        message: "This provider cannot be linked or unlinked",
        code: "provider_not_supported" as const,
      };
    case "WEBAUTHN_CHALLENGE_EXPIRED":
    case "WEBAUTHN_VERIFICATION_FAILED":
      return {
        status: 400 as const,
        message: "Passkey verification failed",
        code: "passkey_failed" as const,
      };
    case "EMAIL_NOT_VERIFIED":
      return {
        status: 403 as const,
        message: "Confirm your email address before signing in",
        code: "email_not_verified" as const,
      };
    case "INVALID_VERIFICATION_TOKEN":
      return {
        status: 400 as const,
        message: "This verification link is invalid or has expired",
        code: "invalid_verification_token" as const,
      };
    case "INVALID_RESET_TOKEN":
      return {
        status: 400 as const,
        message: "This password reset link is invalid or has expired",
        code: "invalid_reset_token" as const,
      };
    case "INVALID_PASSWORD":
      return {
        status: 400 as const,
        message: "Password is required",
        code: "invalid_password" as const,
      };
    case "EMAIL_ALREADY_VERIFIED":
      return {
        status: 400 as const,
        message: "Email is already verified",
        code: "email_already_verified" as const,
      };
    case "MAIL_SEND_FAILED":
      return {
        status: 503 as const,
        message: "Could not send email. Try again later.",
        code: "mail_send_failed" as const,
      };
    default:
      return {
        status: 400 as const,
        message: "Login failed",
        code: "login_failed" as const,
      };
  }
}

function redirectWithAuthError(c: Context, code: string, isLink: boolean) {
  const base = isLink ? `${webUrl()}/account` : `${webUrl()}/login`;
  return c.redirect(`${base}?error=${encodeURIComponent(code)}`);
}

authRoutes.get("/config", (c) => {
  return c.json({ providers: getPublicLoginConfig() });
});

authRoutes.get("/login/:provider", async (c) => {
  const provider = c.req.param("provider");

  try {
    const { redirectUrl, state, codeVerifier } =
      await startProviderLogin(provider);
    setOAuthStateCookie(c, `${state}|${codeVerifier}|${provider}`);
    return c.redirect(redirectUrl);
  } catch {
    return c.json({ error: "Login provider not available" }, 404);
  }
});

authRoutes.get("/link/:provider", async (c) => {
  const provider = c.req.param("provider");
  const user = requireAuth(c);

  const adapter = getLoginAdapter(provider);
  if (!adapter?.isEnabled() || !isRedirectLoginAdapter(adapter)) {
    return c.json({ error: "Login provider not available" }, 404);
  }
  if (!isRedirectProvider(provider as LoginProviderType)) {
    return c.json({ error: "This provider cannot be linked" }, 400);
  }

  try {
    const { redirectUrl, state, codeVerifier } =
      await startProviderLogin(provider);
    setOAuthStateCookie(
      c,
      `${state}|${codeVerifier}|${provider}|link|${user.id}`,
    );
    return c.redirect(redirectUrl);
  } catch {
    return c.json({ error: "Login provider not available" }, 404);
  }
});

authRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");
  const oauthCookie = getCookie(c, "sd_oauth_state");

  if (oauthError) {
    const parsed = oauthCookie ? parseOAuthStateCookie(oauthCookie) : null;
    const isLink = Boolean(parsed?.linkUserId);
    deleteCookie(c, "sd_oauth_state");
    const errorCode =
      oauthError === "access_denied" ? "oauth_cancelled" : "login_failed";
    return redirectWithAuthError(c, errorCode, isLink);
  }

  if (!code || !state || !oauthCookie) {
    return c.json({ error: "Invalid callback" }, 400);
  }

  const parsed = parseOAuthStateCookie(oauthCookie);
  if (!parsed || parsed.storedState !== state) {
    return c.json({ error: "State mismatch" }, 400);
  }

  const { codeVerifier, provider, linkUserId } = parsed;
  const isLink = Boolean(linkUserId);

  try {
    if (isLink) {
      const sessionUser = c.get("user");
      if (!sessionUser || sessionUser.id !== linkUserId) {
        logger.warn(
          { provider, linkUserId, sessionUserId: sessionUser?.id },
          "oauth link callback session mismatch",
        );
        deleteCookie(c, "sd_oauth_state");
        return redirectWithAuthError(c, "link_session_expired", true);
      }

      const identity = await completeProviderIdentity(provider, {
        code,
        codeVerifier,
      });
      await linkProviderToUser(
        sessionUser.id,
        provider as LoginProviderType,
        identity.externalSub,
      );
      deleteCookie(c, "sd_oauth_state");

      await auditLog({
        userId: sessionUser.id,
        action: "link_provider",
        resourceType: "user",
        resourceId: sessionUser.id,
        metadata: { provider },
      });

      return c.redirect(
        `${webUrl()}/account?linked=${encodeURIComponent(provider)}`,
      );
    }

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

    return c.redirect(webUrl());
  } catch (err) {
    logger.warn(
      {
        err,
        provider,
        mode: isLink ? "link" : "login",
        message: err instanceof Error ? err.message : String(err),
      },
      "oauth callback failed",
    );
    deleteCookie(c, "sd_oauth_state");
    const mapped = mapAuthError(err);
    return redirectWithAuthError(c, mapped.code, isLink);
  }
});

authRoutes.get("/account", async (c) => {
  const user = requireAuth(c);
  const [linked, signInMethodCount] = await Promise.all([
    listLinkedProviders(user.id),
    countSignInMethods(user.id),
  ]);

  const linkedTypes = new Set(linked.map((row) => row.provider));
  const redirectProviders = getPublicLoginConfig().filter(
    (config) => config.type !== "local" && isRedirectProvider(config.type),
  );

  return c.json({
    user,
    linkedProviders: linked.map((row) => ({
      provider: row.provider,
      linkedAt: row.createdAt.toISOString(),
      canUnlink: signInMethodCount > 1,
    })),
    availableProviders: redirectProviders.map((config) => ({
      type: config.type,
      label: config.label,
      linked: linkedTypes.has(config.type),
    })),
    hasLocalSignIn: linkedTypes.has("local"),
  });
});

authRoutes.delete("/account/providers/:provider", async (c) => {
  const user = requireAuth(c);
  const provider = c.req.param("provider") as LoginProviderType;

  try {
    await unlinkProviderFromUser(user.id, provider);
    await auditLog({
      userId: user.id,
      action: "unlink_provider",
      resourceType: "user",
      resourceId: user.id,
      metadata: { provider },
    });
    return c.json({ ok: true });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
  }
});

authRoutes.post("/login/:provider", async (c) => {
  const provider = c.req.param("provider");
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : undefined;
  const password =
    typeof body.password === "string" ? body.password : undefined;
  const name = typeof body.name === "string" ? body.name : undefined;
  const mode = body.mode === "signup" ? "signup" : "login";

  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  try {
    const result = await credentialProviderLogin(provider, {
      email,
      password,
      name,
      mode,
    });

    if (result.requiresVerification) {
      await auditLog({
        action: "signup",
        resourceType: "user",
        metadata: { provider, method: "password", pendingVerification: true },
      });
      return c.json({
        requiresVerification: true,
        message: "Check your email to confirm your account before signing in.",
      });
    }

    setSessionCookie(c, result.token);

    await auditLog({
      userId: result.user.id,
      action: mode === "signup" ? "signup" : "login",
      resourceType: "user",
      resourceId: result.user.id,
      metadata: { provider, method: "password" },
    });

    return c.json({ user: result.user });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
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
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
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
    const result = await passkeyRegistrationVerify(provider, {
      email,
      name,
      response,
    });

    if (result.requiresVerification) {
      await auditLog({
        action: "signup",
        resourceType: "user",
        metadata: { provider, method: "passkey", pendingVerification: true },
      });
      return c.json({
        requiresVerification: true,
        message: "Check your email to confirm your account before signing in.",
      });
    }

    setSessionCookie(c, result.token);

    await auditLog({
      userId: result.user.id,
      action: "signup",
      resourceType: "user",
      resourceId: result.user.id,
      metadata: { provider, method: "passkey" },
    });

    return c.json({ user: result.user });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
  }
});

authRoutes.post("/login/:provider/passkey/authenticate/options", async (c) => {
  const provider = c.req.param("provider");

  try {
    const options = await passkeyAuthenticationOptions(provider);
    return c.json(options);
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
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
    const { token, user } = await passkeyAuthenticationVerify(
      provider,
      response,
    );
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
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
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

authRoutes.post("/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";

  if (!email.trim()) {
    return c.json({ error: "Email is required" }, 400);
  }

  try {
    await requestPasswordReset(email);
    return c.json({
      ok: true,
      message:
        "If an account exists for that email, a reset link has been sent.",
    });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
  }
});

authRoutes.post("/reset-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return c.json({ error: "Token and password are required" }, 400);
  }

  try {
    await resetPasswordWithToken(token, password);
    return c.json({
      ok: true,
      message: "Password updated. You can sign in now.",
    });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
  }
});

authRoutes.post("/verify-email", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";

  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  try {
    const { userId } = await verifyEmailWithToken(token);
    await auditLog({
      userId,
      action: "verify_email",
      resourceType: "user",
      resourceId: userId,
    });
    return c.json({
      ok: true,
      message: "Email confirmed. You can sign in now.",
    });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
  }
});

authRoutes.post("/resend-verification", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  try {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, emailVerifiedAt: true },
    });

    if (!user || user.emailVerifiedAt) {
      return c.json({
        ok: true,
        message:
          "If an unverified account exists for that email, a confirmation link has been sent.",
      });
    }

    await resendEmailVerification(user.id);
    return c.json({
      ok: true,
      message:
        "If an unverified account exists for that email, a confirmation link has been sent.",
    });
  } catch (err) {
    const mapped = mapAuthError(err);
    return c.json({ error: mapped.message, code: mapped.code }, mapped.status);
  }
});

export { authRoutes };
