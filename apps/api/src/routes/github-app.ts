import { isGithubAppConfigured, isGithubAppEnabled } from "@servicebeard/providers";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import {
    decodeGithubAppInstallCookie,
    GITHUB_APP_INSTALL_COMPLETE_PATH,
    GITHUB_APP_INSTALL_COOKIE,
    webAppRedirect,
} from "../lib/github-app-install";

const githubAppRoutes = new Hono();

githubAppRoutes.get("/config", (c) => {
  return c.json({
    enabled: isGithubAppEnabled(),
    configured: isGithubAppConfigured(),
  });
});

githubAppRoutes.get("/setup", (c) => {
  try {
    const installationId = c.req.query("installation_id");
    const state = c.req.query("state");
    const cookie = getCookie(c, GITHUB_APP_INSTALL_COOKIE);

    if (!installationId || !state || !cookie) {
      return c.redirect(
        webAppRedirect(`${GITHUB_APP_INSTALL_COMPLETE_PATH}?githubAppError=invalid_callback`),
      );
    }

    const payload = decodeGithubAppInstallCookie(cookie);
    if (!payload || payload.state !== state) {
      return c.redirect(
        webAppRedirect(`${GITHUB_APP_INSTALL_COMPLETE_PATH}?githubAppError=state_mismatch`),
      );
    }

    deleteCookie(c, GITHUB_APP_INSTALL_COOKIE, { path: "/" });

    if (payload.popup) {
      return c.redirect(
        webAppRedirect(
          `${GITHUB_APP_INSTALL_COMPLETE_PATH}?githubInstallationId=${encodeURIComponent(installationId)}`,
        ),
      );
    }

    const separator = payload.returnTo.includes("?") ? "&" : "?";
    return c.redirect(
      webAppRedirect(
        `${payload.returnTo}${separator}githubInstallationId=${encodeURIComponent(installationId)}`,
      ),
    );
  } catch {
    return c.redirect(
      webAppRedirect(`${GITHUB_APP_INSTALL_COMPLETE_PATH}?githubAppError=invalid_callback`),
    );
  }
});

export { githubAppRoutes };
