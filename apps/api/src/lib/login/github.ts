import { getOAuthCallbackUrl, isGithubLoginEnabled } from "../env";
import { createPkceOAuthStart, exchangeOAuthCode } from "./oauth2-pkce";
import type { RedirectLoginAdapter } from "./types";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

function isGithubSignupEnabled(): boolean {
  if (process.env.GITHUB_SIGNUP === "false") return false;
  return true;
}

function getGithubConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = getOAuthCallbackUrl();

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth configuration is incomplete");
  }

  return { clientId, clientSecret, redirectUri };
}

async function fetchGithubUser(accessToken: string) {
  const res = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "servicebeard",
    },
  });

  if (!res.ok) {
    throw new Error("OAUTH_USER_FETCH_FAILED");
  }

  return res.json() as Promise<{
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  }>;
}

async function fetchGithubPrimaryEmail(accessToken: string) {
  const res = await fetch(`${GITHUB_API_URL}/user/emails`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "servicebeard",
    },
  });

  if (!res.ok) {
    throw new Error("OAUTH_USER_FETCH_FAILED");
  }

  const emails = (await res.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  const primary = emails.find((entry) => entry.primary && entry.verified);
  return (
    primary?.email ?? emails.find((entry) => entry.verified)?.email ?? null
  );
}

export class GithubLoginAdapter implements RedirectLoginAdapter {
  readonly type = "github" as const;
  readonly label = "Continue with GitHub";
  readonly settings = { signupEnabled: isGithubSignupEnabled() };

  isEnabled(): boolean {
    return isGithubLoginEnabled();
  }

  toPublicConfig() {
    return {
      type: this.type,
      label: this.label,
      signupEnabled: this.settings.signupEnabled,
    };
  }

  async startLogin() {
    const { clientId, redirectUri } = getGithubConfig();

    return createPkceOAuthStart(GITHUB_AUTHORIZE_URL, {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
    });
  }

  async completeLogin(params: { code: string; codeVerifier: string }) {
    const { clientId, clientSecret, redirectUri } = getGithubConfig();

    const { access_token } = await exchangeOAuthCode(GITHUB_TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      redirect_uri: redirectUri,
      code_verifier: params.codeVerifier,
    });

    const profile = await fetchGithubUser(access_token);
    const email =
      profile.email ??
      (await fetchGithubPrimaryEmail(access_token)) ??
      `${profile.login}@users.noreply.github.com`;

    return {
      externalSub: `github:${profile.id}`,
      email,
      name: profile.name ?? profile.login,
      avatarUrl: profile.avatar_url,
    };
  }
}
