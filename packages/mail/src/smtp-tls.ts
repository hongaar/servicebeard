import * as tls from "node:tls";

/**
 * TLS options for nodemailer SMTP transports.
 *
 * Workaround for a Bun bug: on STARTTLS-upgraded client sockets, Bun can hand
 * `checkServerIdentity` an empty peer-certificate object. See oven-sh/bun#21902.
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
