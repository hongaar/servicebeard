import tls from "node:tls";

/**
 * TLS options for nodemailer SMTP transports.
 *
 * Workaround for a Bun bug: on STARTTLS-upgraded client sockets, Bun can hand
 * `checkServerIdentity` an empty peer-certificate object, so the built-in
 * hostname check throws `Cert does not contain a DNS name` even though the
 * certificate chain was already validated by BoringSSL (`rejectUnauthorized`
 * stays on). We run the real hostname check whenever Bun actually provides a
 * populated certificate, and only tolerate the empty-cert case.
 *
 * Remove once Bun reliably exposes the peer certificate on upgraded sockets.
 * See https://github.com/oven-sh/bun/issues/21902
 */
export function smtpTlsOptions(host: string): tls.ConnectionOptions {
  return {
    servername: host,
    checkServerIdentity(hostname, cert) {
      if (!cert || (!cert.subject && !cert.subjectaltname)) {
        return undefined;
      }
      return tls.checkServerIdentity(hostname, cert);
    },
  };
}
