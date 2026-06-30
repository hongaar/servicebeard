export const LOGIN_PROVIDER_TYPES = [
  "oidc",
  "github",
  "gitlab",
  "local",
] as const;
export type LoginProviderType = (typeof LOGIN_PROVIDER_TYPES)[number];

export interface LoginProviderPublicConfig {
  type: LoginProviderType;
  label: string;
  signupEnabled: boolean;
  passkeyEnabled?: boolean;
  defaults?: {
    email: string;
    name: string;
    password?: string;
  };
}

export interface AuthConfigResponse {
  providers: LoginProviderPublicConfig[];
}
