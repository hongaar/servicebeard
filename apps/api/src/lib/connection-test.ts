import { createProvider, toProviderConfig } from "@servicebeard/providers";
import type {
    testMailConnectionSchema,
    testProviderConnectionSchema,
} from "@servicebeard/shared";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { z } from "zod";

type TestMailInput = z.infer<typeof testMailConnectionSchema>;
type TestProviderInput = z.infer<typeof testProviderConnectionSchema>;

export async function testMailConnection(body: TestMailInput) {
  const client = new ImapFlow({
    host: body.imapHost,
    port: body.imapPort,
    secure: body.imapSecure,
    auth: { user: body.imapUser, pass: body.imapPassword },
    logger: false,
  });

  await client.connect();
  await client.logout();

  const transporter = nodemailer.createTransport({
    host: body.smtpHost,
    port: body.smtpPort,
    secure: body.smtpSecure,
    auth: { user: body.smtpUser, pass: body.smtpPassword },
  });
  await transporter.verify();

  return { ok: true as const, imap: true, smtp: true };
}

export async function testProviderConnection(body: TestProviderInput) {
  const provider = createProvider(
    body.provider,
    toProviderConfig({
      baseUrl: body.providerBaseUrl,
      projectId: body.providerProjectId,
      token: body.providerToken ?? "",
      githubInstallationId: body.providerGithubInstallationId?.trim() || null,
      tlsInsecure: body.providerTlsInsecure,
      caCert: body.providerCaCert ?? null,
    }),
  );
  const user = await provider.getCurrentUser();
  return { ok: true as const, user };
}
