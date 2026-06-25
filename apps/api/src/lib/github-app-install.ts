import {
    buildGithubAppInstallUrl,
    getGithubAppSlug,
    isGithubAppConfigured,
    isGithubAppEnabled,
} from "@servicebeard/providers";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";
import type { AppVariables } from "../middleware/auth";

export const GITHUB_APP_INSTALL_COOKIE = "sd_github_app_install";

export const GITHUB_APP_INSTALL_COMPLETE_PATH = "/github-app/install-complete";

interface GithubAppInstallCookie {
  state: string;
  teamId: string;
  returnTo: string;
  popup?: boolean;
}

export function encodeGithubAppInstallCookie(payload: GithubAppInstallCookie): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeGithubAppInstallCookie(
  cookie: string,
): GithubAppInstallCookie | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cookie, "base64url").toString("utf8"),
    ) as GithubAppInstallCookie;
    if (!parsed.state || !parsed.teamId || !parsed.returnTo) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function defaultGithubAppReturnTo(teamId: string): string {
  return `/teams/${teamId}/projects?create=1&wizardStep=provider`;
}

export function sanitizeGithubAppReturnTo(returnTo: string | undefined, teamId: string): string {
  const fallback = defaultGithubAppReturnTo(teamId);
  if (!returnTo?.startsWith("/")) return fallback;
  if (returnTo.includes("://")) return fallback;
  if (!returnTo.startsWith(`/teams/${teamId}/`)) return fallback;
  return returnTo;
}

export function webAppRedirect(path: string): string {
  const webUrl = (process.env.WEB_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${webUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function githubAppInstallErrorRedirect(
  returnTo: string,
  popup: boolean,
  error: string,
): string {
  if (popup) {
    return webAppRedirect(
      `${GITHUB_APP_INSTALL_COMPLETE_PATH}?githubAppError=${encodeURIComponent(error)}`,
    );
  }
  const separator = returnTo.includes("?") ? "&" : "?";
  return webAppRedirect(`${returnTo}${separator}githubAppError=${error}`);
}

export async function startGithubAppInstall(
  c: Context<{ Variables: AppVariables }>,
  teamId: string,
): Promise<Response> {
  const popup = c.req.query("popup") === "1";
  const returnTo = popup
    ? GITHUB_APP_INSTALL_COMPLETE_PATH
    : sanitizeGithubAppReturnTo(c.req.query("returnTo"), teamId);
  const baseUrl = c.req.query("baseUrl")?.trim() || "https://github.com";

  if (!isGithubAppEnabled()) {
    return c.redirect(githubAppInstallErrorRedirect(returnTo, popup, "disabled"));
  }

  if (!isGithubAppConfigured()) {
    return c.redirect(githubAppInstallErrorRedirect(returnTo, popup, "not_configured"));
  }

  const state = randomBytes(24).toString("hex");
  setCookie(
    c,
    GITHUB_APP_INSTALL_COOKIE,
    encodeGithubAppInstallCookie({ state, teamId, returnTo, popup }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 600,
      path: "/",
    },
  );

  try {
    const slug = await getGithubAppSlug(baseUrl);
    const installUrl = buildGithubAppInstallUrl(baseUrl, slug, state);
    return c.redirect(installUrl);
  } catch {
    return c.redirect(githubAppInstallErrorRedirect(returnTo, popup, "install_failed"));
  }
}
