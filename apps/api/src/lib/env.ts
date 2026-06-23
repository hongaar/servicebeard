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
  const flag = parseEnvFlag(process.env.OIDC_LOGIN);
  if (flag === false) return false;
  if (flag === true) return isOidcConfigured();
  return isOidcConfigured();
}

export function isLocalLoginEnabled(): boolean {
  const flag = parseEnvFlag(process.env.LOCAL_LOGIN);
  if (flag === false) return false;
  if (flag === true) return true;
  return process.env.NODE_ENV !== "production";
}
