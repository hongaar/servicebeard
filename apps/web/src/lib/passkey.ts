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

function isPasskeyCancelled(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return true;
  }
  if (err instanceof Error) {
    return (
      err.name === "NotAllowedError" ||
      err.message.includes("timed out or was not allowed")
    );
  }
  return false;
}

export function passkeyErrorMessage(
  err: unknown,
  cancelled: string,
  fallback: string,
): string {
  if (isPasskeyCancelled(err)) {
    return cancelled;
  }
  return err instanceof Error ? err.message : fallback;
}
