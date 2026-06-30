function parseEnvFlag(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/** Browser OAuth callback — must match the origin that sets the OAuth state cookie. */
export function getOAuthCallbackUrl(): string {
  if (process.env.OAUTH_REDIRECT_URI?.trim()) {
    return process.env.OAUTH_REDIRECT_URI.trim();
  }

  const webUrl = process.env.WEB_URL?.trim();
  if (webUrl) {
    return `${webUrl.replace(/\/$/, "")}/api/auth/callback`;
  }

  return `${(process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/auth/callback`;
}

function isOidcConfigured(): boolean {
  return Boolean(
    process.env.OIDC_ISSUER &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET,
  );
}

export function isOidcLoginEnabled(): boolean {
  if (parseEnvFlag(process.env.OIDC_LOGIN) !== true) return false;
  return isOidcConfigured();
}

export function isLocalLoginEnabled(): boolean {
  return parseEnvFlag(process.env.LOCAL_LOGIN) === true;
}

function isGithubConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
}

export function isGithubLoginEnabled(): boolean {
  if (parseEnvFlag(process.env.GITHUB_LOGIN) !== true) return false;
  return isGithubConfigured();
}

function isGitlabConfigured(): boolean {
  return Boolean(
    process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET,
  );
}

export function isGitlabLoginEnabled(): boolean {
  if (parseEnvFlag(process.env.GITLAB_LOGIN) !== true) return false;
  return isGitlabConfigured();
}
