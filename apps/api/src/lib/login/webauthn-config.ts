function parseOrigin(url: string): string {
  return new URL(url).origin;
}

function parseRpId(url: string): string {
  return new URL(url).hostname;
}

export function getWebAuthnConfig() {
  const origin = process.env.WEBAUTHN_ORIGIN ?? process.env.WEB_URL ?? "http://localhost:5173";
  const rpId = process.env.WEBAUTHN_RP_ID ?? parseRpId(origin);
  const rpName = process.env.WEBAUTHN_RP_NAME ?? "Servicebeard";

  return {
    rpName,
    rpId,
    origin: parseOrigin(origin),
  };
}

export function emailToUserHandle(email: string): Uint8Array {
  const bytes = new TextEncoder().encode(email.toLowerCase());
  if (bytes.length > 64) {
    throw new Error("EMAIL_TOO_LONG_FOR_PASSKEY");
  }
  return bytes;
}

export function userHandleToEmail(userHandle: string): string {
  const bytes = Uint8Array.from(atob(userHandle), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes).toLowerCase();
}
