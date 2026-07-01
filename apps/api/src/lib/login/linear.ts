import { getOAuthCallbackUrl, isLinearLoginEnabled } from "../env";
import { createPkceOAuthStart, exchangeOAuthCode } from "./oauth2-pkce";
import type { RedirectLoginAdapter } from "./types";

const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_API_URL = "https://api.linear.app/graphql";

function isLinearSignupEnabled(): boolean {
  if (process.env.LINEAR_SIGNUP === "false") return false;
  return true;
}

function getLinearConfig() {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const redirectUri = getOAuthCallbackUrl();

  if (!clientId || !clientSecret) {
    throw new Error("Linear OAuth configuration is incomplete");
  }

  return { clientId, clientSecret, redirectUri };
}

async function fetchLinearUser(accessToken: string) {
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `{
        viewer {
          id
          name
          displayName
          email
          avatarUrl
        }
      }`,
    }),
  });

  if (!res.ok) {
    throw new Error("OAUTH_USER_FETCH_FAILED");
  }

  const payload = (await res.json()) as {
    data?: {
      viewer?: {
        id: string;
        name: string;
        displayName: string | null;
        email: string | null;
        avatarUrl: string | null;
      };
    };
  };

  const viewer = payload.data?.viewer;
  if (!viewer?.id) {
    throw new Error("OAUTH_USER_FETCH_FAILED");
  }

  return viewer;
}

export class LinearLoginAdapter implements RedirectLoginAdapter {
  readonly type = "linear" as const;
  readonly label = "Continue with Linear";
  readonly settings = { signupEnabled: isLinearSignupEnabled() };

  isEnabled(): boolean {
    return isLinearLoginEnabled();
  }

  toPublicConfig() {
    return {
      type: this.type,
      label: this.label,
      signupEnabled: this.settings.signupEnabled,
    };
  }

  async startLogin() {
    const { clientId, redirectUri } = getLinearConfig();

    return createPkceOAuthStart(LINEAR_AUTHORIZE_URL, {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "read",
    });
  }

  async completeLogin(params: { code: string; codeVerifier: string }) {
    const { clientId, clientSecret, redirectUri } = getLinearConfig();

    const { access_token } = await exchangeOAuthCode(LINEAR_TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: params.codeVerifier,
    });

    const profile = await fetchLinearUser(access_token);
    const displayName = profile.displayName?.trim() || profile.name;
    const email =
      profile.email ??
      `${displayName.replace(/\s+/g, ".").toLowerCase()}@users.noreply.linear.app`;

    return {
      externalSub: `linear:${profile.id}`,
      email,
      name: displayName,
      avatarUrl: profile.avatarUrl,
    };
  }
}
