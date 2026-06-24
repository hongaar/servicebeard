import { GithubLoginAdapter } from "./github";
import { GitlabLoginAdapter } from "./gitlab";
import { LocalLoginAdapter } from "./local";
import { OidcLoginAdapter } from "./oidc";
import type { LoginAdapter } from "./types";
export {
    isCredentialLoginAdapter,
    isRedirectLoginAdapter
} from "./types";
export type {
    CredentialLoginAdapter,
    LoginAdapter,
    LoginAdapterSettings,
    LoginIdentity,
    OidcLoginStart,
    RedirectLoginAdapter
} from "./types";

const adapters: LoginAdapter[] = [
  new OidcLoginAdapter(),
  new GithubLoginAdapter(),
  new GitlabLoginAdapter(),
  new LocalLoginAdapter(),
];

export function getLoginAdapters(): LoginAdapter[] {
  return adapters;
}

export function getEnabledLoginAdapters(): LoginAdapter[] {
  return adapters.filter((adapter) => adapter.isEnabled());
}

export function getLoginAdapter(type: string): LoginAdapter | undefined {
  return adapters.find((adapter) => adapter.type === type);
}

export function getPublicLoginConfig() {
  return getEnabledLoginAdapters().map((adapter) => adapter.toPublicConfig());
}
