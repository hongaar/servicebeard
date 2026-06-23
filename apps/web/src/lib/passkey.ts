import {
    startAuthentication,
    startRegistration,
} from "@simplewebauthn/browser";
import { api } from "./api";

export async function registerPasskey(
  provider: string,
  input: { email: string; name: string },
) {
  const options = await api.passkeyRegisterOptions(provider, input);
  const response = await startRegistration({ optionsJSON: options });
  return api.passkeyRegisterVerify(provider, { ...input, response });
}

export async function authenticateWithPasskey(provider: string) {
  const options = await api.passkeyAuthenticateOptions(provider);
  const response = await startAuthentication({ optionsJSON: options });
  return api.passkeyAuthenticateVerify(provider, { response });
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}
