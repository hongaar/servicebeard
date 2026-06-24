import { isGitlabLoginEnabled } from "../env";
import { createPkceOAuthStart, exchangeOAuthCode } from "./oauth2-pkce";
import type { RedirectLoginAdapter } from "./types";

function isGitlabSignupEnabled(): boolean {
  if (process.env.GITLAB_SIGNUP === "false") return false;
  return true;
}

function getGitlabBaseUrl(): string {
  return (process.env.GITLAB_BASE_URL ?? "https://gitlab.com").replace(/\/$/, "");
}

function getGitlabConfig() {
  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  const redirectUri = process.env.GITLAB_REDIRECT_URI;
  const baseUrl = getGitlabBaseUrl();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GitLab OAuth configuration is incomplete");
  }

  return { clientId, clientSecret, redirectUri, baseUrl };
}

async function fetchGitlabUser(accessToken: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/v4/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error("OAUTH_USER_FETCH_FAILED");
  }

  return res.json() as Promise<{
    id: number;
    username: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  }>;
}

export class GitlabLoginAdapter implements RedirectLoginAdapter {
  readonly type = "gitlab" as const;
  readonly label = "Continue with GitLab";
  readonly settings = { signupEnabled: isGitlabSignupEnabled() };

  isEnabled(): boolean {
    return isGitlabLoginEnabled();
  }

  toPublicConfig() {
    return {
      type: this.type,
      label: this.label,
      signupEnabled: this.settings.signupEnabled,
    };
  }

  async startLogin() {
    const { clientId, redirectUri, baseUrl } = getGitlabConfig();

    return createPkceOAuthStart(`${baseUrl}/oauth/authorize`, {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "read_user",
    });
  }

  async completeLogin(params: { code: string; codeVerifier: string }) {
    const { clientId, clientSecret, redirectUri, baseUrl } = getGitlabConfig();

    const { access_token } = await exchangeOAuthCode(`${baseUrl}/oauth/token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: params.codeVerifier,
    });

    const profile = await fetchGitlabUser(access_token, baseUrl);
    const email =
      profile.email ?? `${profile.username}@users.noreply.gitlab.com`;

    return {
      externalSub: `gitlab:${profile.id}`,
      email,
      name: profile.name ?? profile.username,
      avatarUrl: profile.avatar_url,
    };
  }
}
