import { extractEmailDomain } from "@servicebeard/shared/mail-autoconfig";
import {
  mailAutoconfigFromSrvRecords,
  parseMicrosoftAutodiscoverXml,
  parseMozillaAutoconfigXml,
  type MailDiscoverResult,
} from "@servicebeard/shared/mail-discover";
import { resolveSrv } from "node:dns/promises";

const FETCH_TIMEOUT_MS = 5_000;

function isDiscoverableDomain(domain: string): boolean {
  if (
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(
      domain,
    )
  ) {
    return false;
  }
  if (
    domain === "localhost" ||
    domain.endsWith(".localhost") ||
    domain.endsWith(".local") ||
    domain.endsWith(".internal")
  ) {
    return false;
  }
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/xml,text/xml,*/*" },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveSrvTarget(
  service: string,
): Promise<{ name: string; port: number } | null> {
  try {
    const records = await resolveSrv(service);
    if (records.length === 0) return null;
    records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    const best = records[0];
    return { name: best.name, port: best.port };
  } catch {
    return null;
  }
}

async function discoverFromDnsSrv(domain: string): Promise<MailDiscoverResult> {
  const imap =
    (await resolveSrvTarget(`_imaps._tcp.${domain}`)) ??
    (await resolveSrvTarget(`_imap._tcp.${domain}`));
  const smtp =
    (await resolveSrvTarget(`_submissions._tcp.${domain}`)) ??
    (await resolveSrvTarget(`_submission._tcp.${domain}`));
  if (!imap || !smtp) return { found: false };

  return {
    found: true,
    config: {
      ...mailAutoconfigFromSrvRecords(imap, smtp, domain),
      source: "dns-srv",
    },
  };
}

async function discoverFromMozillaAutoconfig(
  email: string,
  domain: string,
): Promise<MailDiscoverResult> {
  const query = `?emailaddress=${encodeURIComponent(email)}`;
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml${query}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml${query}`,
  ];

  for (const url of urls) {
    const xml = await fetchText(url);
    if (!xml) continue;
    const config = parseMozillaAutoconfigXml(xml, domain);
    if (config) {
      return {
        found: true,
        config: { ...config, source: "mozilla-autoconfig" },
      };
    }
  }

  return { found: false };
}

async function discoverFromMicrosoftAutodiscover(
  email: string,
  domain: string,
): Promise<MailDiscoverResult> {
  const autodiscoverHost =
    (await resolveSrvTarget(`_autodiscover._tcp.${domain}`))?.name.replace(
      /\.$/,
      "",
    ) ?? `autodiscover.${domain}`;

  const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006">
  <Request>
    <EMailAddress>${email}</EMailAddress>
    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>
  </Request>
</Autodiscover>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://${autodiscoverHost}/autodiscover/autodiscover.xml`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
        },
        body: requestBody,
        redirect: "follow",
      },
    );
    if (!response.ok) return { found: false };
    const xml = await response.text();
    const config = parseMicrosoftAutodiscoverXml(xml, domain);
    if (!config) return { found: false };
    return {
      found: true,
      config: { ...config, source: "microsoft-autodiscover" },
    };
  } catch {
    return { found: false };
  } finally {
    clearTimeout(timeout);
  }
}

/** Discover IMAP/SMTP settings via DNS SRV, Mozilla autoconfig, and Microsoft autodiscover. */
export async function discoverMailAutoconfig(
  email: string,
): Promise<MailDiscoverResult> {
  const domain = extractEmailDomain(email);
  if (!domain || !isDiscoverableDomain(domain)) return { found: false };

  const trimmedEmail = email.trim();

  const srv = await discoverFromDnsSrv(domain);
  if (srv.found) return srv;

  const mozilla = await discoverFromMozillaAutoconfig(trimmedEmail, domain);
  if (mozilla.found) return mozilla;

  return discoverFromMicrosoftAutodiscover(trimmedEmail, domain);
}
