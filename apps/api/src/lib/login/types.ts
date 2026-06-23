import type {
    LoginProviderPublicConfig,
    LoginProviderType,
} from "@serviceboard/shared";

export interface LoginAdapterSettings {
  signupEnabled: boolean;
}

export interface LoginIdentity {
  externalSub: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
}

export interface OidcLoginStart {
  redirectUrl: string;
  state: string;
  codeVerifier: string;
}

export interface LoginAdapter {
  readonly type: LoginProviderType;
  readonly label: string;
  readonly settings: LoginAdapterSettings;
  isEnabled(): boolean;
  toPublicConfig(): LoginProviderPublicConfig;
}

export interface RedirectLoginAdapter extends LoginAdapter {
  startLogin(): Promise<OidcLoginStart>;
  completeLogin(params: {
    code: string;
    codeVerifier: string;
  }): Promise<LoginIdentity>;
}

export interface CredentialLoginAdapter extends LoginAdapter {
  login(credentials: {
    email: string;
    password: string;
    name?: string;
    mode: "login" | "signup";
  }): Promise<LoginIdentity>;
}

export function isRedirectLoginAdapter(
  adapter: LoginAdapter,
): adapter is RedirectLoginAdapter {
  return (
    "startLogin" in adapter &&
    typeof adapter.startLogin === "function" &&
    "completeLogin" in adapter &&
    typeof adapter.completeLogin === "function"
  );
}

export function isCredentialLoginAdapter(
  adapter: LoginAdapter,
): adapter is CredentialLoginAdapter {
  return "login" in adapter && typeof adapter.login === "function";
}
