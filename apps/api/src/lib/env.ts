function parseEnvFlag(
  value: string | undefined,
): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function isOidcConfigured(): boolean {
  return Boolean(
    process.env.OIDC_ISSUER &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET &&
      process.env.OIDC_REDIRECT_URI,
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
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.GITHUB_REDIRECT_URI,
  );
}

export function isGithubLoginEnabled(): boolean {
  if (parseEnvFlag(process.env.GITHUB_LOGIN) !== true) return false;
  return isGithubConfigured();
}

function isGitlabConfigured(): boolean {
  return Boolean(
    process.env.GITLAB_CLIENT_ID &&
      process.env.GITLAB_CLIENT_SECRET &&
      process.env.GITLAB_REDIRECT_URI,
  );
}

export function isGitlabLoginEnabled(): boolean {
  if (parseEnvFlag(process.env.GITLAB_LOGIN) !== true) return false;
  return isGitlabConfigured();
}
