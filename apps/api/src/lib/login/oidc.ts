import * as client from "openid-client";
import { getOAuthCallbackUrl, isOidcLoginEnabled } from "../env";
import type { RedirectLoginAdapter } from "./types";

let oidcConfig: client.Configuration | null = null;

async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    const issuer = process.env.OIDC_ISSUER;
    const clientId = process.env.OIDC_CLIENT_ID;
    const clientSecret = process.env.OIDC_CLIENT_SECRET;

    if (!issuer || !clientId || !clientSecret) {
      throw new Error("OIDC configuration is incomplete");
    }

    oidcConfig = await client.discovery(
      new URL(issuer),
      clientId,
      clientSecret,
    );
  }
  return oidcConfig;
}

function getOidcLabel(): string {
  const name = process.env.OIDC_PROVIDER_NAME?.trim();
  return name ? `Continue with ${name}` : "Continue with SSO";
}

function isOidcSignupEnabled(): boolean {
  if (process.env.OIDC_SIGNUP === "false") return false;
  return true;
}

export class OidcLoginAdapter implements RedirectLoginAdapter {
  readonly type = "oidc" as const;
  readonly label = getOidcLabel();
  readonly settings = { signupEnabled: isOidcSignupEnabled() };

  isEnabled(): boolean {
    return isOidcLoginEnabled();
  }

  toPublicConfig() {
    return {
      type: this.type,
      label: getOidcLabel(),
      signupEnabled: this.settings.signupEnabled,
    };
  }

  async startLogin() {
    const config = await getOidcConfig();
    const redirectUri = getOAuthCallbackUrl();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    return {
      redirectUrl: authUrl.href,
      state,
      codeVerifier,
    };
  }

  async completeLogin(params: { code: string; codeVerifier: string }) {
    const config = await getOidcConfig();
    const redirectUri = getOAuthCallbackUrl();

    const tokens = await client.authorizationCodeGrant(
      config,
      new URL(`${redirectUri}?code=${params.code}`),
      { pkceCodeVerifier: params.codeVerifier },
    );

    const claims = tokens.claims();
    if (!claims) throw new Error("No claims in token");

    const sub = claims.sub;
    const email = (claims.email as string) ?? `${sub}@unknown.local`;
    const name = (claims.name as string) ?? null;
    const picture = (claims.picture as string) ?? null;

    return {
      externalSub: sub,
      email,
      name,
      avatarUrl: picture,
    };
  }
}
