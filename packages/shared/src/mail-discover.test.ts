import { describe, expect, test } from "bun:test";

describe("mail discovery parsers", () => {
  test("parses Mozilla autoconfig XML", async () => {
    const { parseMozillaAutoconfigXml } =
      await import("@servicebeard/shared/mail-discover");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="migadu.com">
    <displayName>Migadu</displayName>
    <incomingServer type="imap">
      <hostname>imap.migadu.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>smtp.migadu.com</hostname>
      <port>465</port>
      <socketType>SSL</socketType>
    </outgoingServer>
  </emailProvider>
</clientConfig>`;

    expect(parseMozillaAutoconfigXml(xml, "servicebeard.app")).toEqual({
      providerName: "Migadu",
      imap: { host: "imap.migadu.com", port: 993, secure: true },
      smtp: { host: "smtp.migadu.com", port: 465, secure: true },
    });
  });

  test("parses Microsoft autodiscover XML", async () => {
    const { parseMicrosoftAutodiscoverXml } =
      await import("@servicebeard/shared/mail-discover");
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <Protocol>
        <Type>IMAP</Type>
        <Server>imap.example.com</Server>
        <Port>993</Port>
        <SSL>on</SSL>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>smtp.example.com</Server>
        <Port>465</Port>
        <SSL>on</SSL>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>`;

    expect(parseMicrosoftAutodiscoverXml(xml, "servicebeard.app")).toEqual({
      providerName: "servicebeard.app",
      imap: { host: "imap.example.com", port: 993, secure: true },
      smtp: { host: "smtp.example.com", port: 465, secure: true },
    });
  });

  test("builds config from DNS SRV targets", async () => {
    const { mailAutoconfigFromSrvRecords } =
      await import("@servicebeard/shared/mail-discover");

    expect(
      mailAutoconfigFromSrvRecords(
        { name: "imap.migadu.com.", port: 993 },
        { name: "smtp.migadu.com.", port: 465 },
        "servicebeard.app",
      ),
    ).toEqual({
      providerName: "servicebeard.app",
      imap: { host: "imap.migadu.com", port: 993, secure: true },
      smtp: { host: "smtp.migadu.com", port: 465, secure: true },
    });
  });
});
