import * as client from "openid-client";

export async function createPkceOAuthStart(
  authorizeUrl: string,
  params: Record<string, string>,
): Promise<{ redirectUrl: string; state: string; codeVerifier: string }> {
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const url = new URL(authorizeUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { redirectUrl: url.href, state, codeVerifier };
}

export async function exchangeOAuthCode(
  tokenUrl: string,
  body: Record<string, string>,
): Promise<{ access_token: string }> {
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
  }

  return { access_token: data.access_token };
}
