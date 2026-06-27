import { Link } from "@tanstack/react-router";
import { DocsLayout } from "../../components/DocsLayout";
import { DOC_PATHS } from "../../lib/docs";
import styles from "../../styles/docs.module.css";

export function DocsMailboxPage() {
  return (
    <DocsLayout
      title="Mailbox configuration"
      lead="Connect the support inbox ServiceBeard polls for new messages and uses when sending replies."
    >
      <p>
        Each project has one mailbox. The worker polls <strong>IMAP</strong> for unseen messages and
        sends outbound mail (acknowledgements and comment replies) over <strong>SMTP</strong>. The{" "}
        <strong>Support email address</strong> is both the mailbox login identity and the{" "}
        <code>From</code> address customers see on replies.
      </p>

      <h2>Quick setup in the project wizard</h2>
      <ol>
        <li>
          Enter the <strong>Support email address</strong> (for example{" "}
          <code>support@acme.com</code>).
        </li>
        <li>
          Click <strong>Auto-detect mail settings</strong> for known providers (Gmail, Outlook,
          iCloud, and others) or custom domains with DNS autoconfig/autodiscovery records (for
          example Migadu). ServiceBeard fills in IMAP and SMTP hostnames and ports; you only need
          the mailbox password.
        </li>
        <li>
          If auto-detect is unavailable or fails, choose <strong>Enter manually</strong> and fill in
          the server details yourself.
        </li>
        <li>
          Click <strong>Test mail connection</strong>. A successful test verifies both IMAP login
          and SMTP authentication.
        </li>
      </ol>

      <h2>Fields explained</h2>

      <h3>Support email address</h3>
      <p>
        The address customers write to. ServiceBeard also uses it as the sender on outbound mail.
        When you change this on an existing project, IMAP and SMTP usernames are updated to match
        unless you override them in the server settings.
      </p>

      <h3>IMAP (incoming)</h3>
      <p>Polls the inbox for new messages. Typical settings:</p>
      <ul>
        <li>
          <strong>Port 993</strong> with <strong>IMAP TLS</strong> enabled (implicit TLS)
        </li>
        <li>
          <strong>Port 143</strong> with IMAP TLS off (STARTTLS upgrade — less common today)
        </li>
      </ul>
      <p>
        The worker marks processed messages as seen so they are not imported twice. Use a dedicated
        support inbox rather than a personal mailbox shared with humans.
      </p>

      <h3>SMTP (outgoing)</h3>
      <p>Sends acknowledgement emails and comment replies. Two common patterns:</p>
      <ul>
        <li>
          <strong>Port 465</strong> with <strong>SMTP TLS</strong> enabled (implicit TLS)
        </li>
        <li>
          <strong>Port 587</strong> with SMTP TLS off (STARTTLS — used by Outlook and iCloud in
          ServiceBeard&apos;s presets)
        </li>
      </ul>
      <p>
        Replies are sent as threaded messages so email clients group them with the original
        conversation.
      </p>

      <h2>Auto-detected providers</h2>
      <p>
        Auto-detect matches the domain part of your support address against built-in presets. These
        domains are recognized today:
      </p>

      <div className={styles.providerTableWrap}>
      <table className={styles.providerTable}>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Example domains</th>
            <th>IMAP</th>
            <th>SMTP</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gmail</td>
            <td>
              <div className={styles.providerDomains}>
              <code className={styles.domainChip}>gmail.com</code>
              <code className={styles.domainChip}>googlemail.com</code>
              </div>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>imap.gmail.com:993</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>smtp.gmail.com:465</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
          </tr>
          <tr>
            <td>Outlook / Microsoft 365</td>
            <td>
              <div className={styles.providerDomains}>
              <code className={styles.domainChip}>outlook.com</code>
              <code className={styles.domainChip}>hotmail.com</code>
              <code className={styles.domainChip}>office365.com</code>
              </div>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>outlook.office365.com:993</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>smtp.office365.com:587</code>
                <span className={styles.mailTls}>(STARTTLS)</span>
              </span>
            </td>
          </tr>
          <tr>
            <td>Yahoo Mail</td>
            <td>
              <div className={styles.providerDomains}>
              <code className={styles.domainChip}>yahoo.com</code>
              <code className={styles.domainChip}>ymail.com</code>
              </div>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>imap.mail.yahoo.com:993</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>smtp.mail.yahoo.com:465</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
          </tr>
          <tr>
            <td>iCloud</td>
            <td>
              <div className={styles.providerDomains}>
              <code className={styles.domainChip}>icloud.com</code>
              <code className={styles.domainChip}>me.com</code>
              <code className={styles.domainChip}>mac.com</code>
              </div>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>imap.mail.me.com:993</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>smtp.mail.me.com:587</code>
                <span className={styles.mailTls}>(STARTTLS)</span>
              </span>
            </td>
          </tr>
          <tr>
            <td>Fastmail</td>
            <td>
              <div className={styles.providerDomains}>
              <code className={styles.domainChip}>fastmail.com</code>
              <code className={styles.domainChip}>fastmail.fm</code>
              </div>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>imap.fastmail.com:993</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>smtp.fastmail.com:465</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
          </tr>
          <tr>
            <td>Zoho Mail</td>
            <td>
              <div className={styles.providerDomains}>
              <code className={styles.domainChip}>zoho.com</code>
              </div>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>imap.zoho.com:993</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
            <td>
              <span className={styles.mailEndpoint}>
                <code>smtp.zoho.com:465</code>
                <span className={styles.mailTls}>(TLS)</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <p>
        Custom domains on Google Workspace or Microsoft 365 usually use the same hostnames as Gmail
        or Outlook above — enter your address and use auto-detect, or copy those hostnames manually.
      </p>

      <h2>Provider-specific notes</h2>

      <h3>Gmail and Google Workspace</h3>
      <ul>
        <li>
          Enable IMAP under Gmail → Settings → See all settings → Forwarding and POP/IMAP.
        </li>
        <li>
          If two-factor authentication is on, create an{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
          >
            app password
          </a>{" "}
          and use that instead of your normal Google password.
        </li>
        <li>
          Google may block sign-in from new servers until you allow it in the account security
          alerts.
        </li>
      </ul>

      <h3>Microsoft 365 / Outlook</h3>
      <ul>
        <li>IMAP must be enabled for the mailbox (on by default for many tenants).</li>
        <li>
          SMTP AUTH must be allowed for the mailbox or tenant — some Microsoft 365 plans disable it
          by default.
        </li>
        <li>Use the full email address as the IMAP and SMTP username.</li>
      </ul>

      <h3>iCloud</h3>
      <ul>
        <li>
          Generate an{" "}
          <a
            href="https://appleid.apple.com/account/manage"
            target="_blank"
            rel="noopener noreferrer"
          >
            app-specific password
          </a>{" "}
          when two-factor authentication is enabled.
        </li>
      </ul>

      <h3>Yahoo Mail</h3>
      <ul>
        <li>
          Generate an app password under Account security if you use two-factor authentication.
        </li>
      </ul>

      <h3>Proton Mail</h3>
      <p>
        Proton Mail does not expose standard IMAP/SMTP on the public internet. Use{" "}
        <a href="https://proton.me/mail/bridge" target="_blank" rel="noopener noreferrer">
          Proton Mail Bridge
        </a>{" "}
        on the same host as the ServiceBeard worker and point the project at the Bridge&apos;s local
        ports (<code>127.0.0.1:1143</code> IMAP, <code>127.0.0.1:1025</code> SMTP in
        ServiceBeard&apos;s preset).
      </p>

      <h3>Self-hosted or corporate mail</h3>
      <p>
        Ask your mail administrator for IMAP and SMTP hostnames, ports, and whether to use implicit
        TLS or STARTTLS. If the server uses a private CA, you may need additional TLS configuration
        at the ServiceBeard deployment level — see your platform README for{" "}
        <code>TLS_CA_BUNDLE</code>.
      </p>

      <h2>Poll interval</h2>
      <p>
        The worker checks for new mail on a fixed schedule configured by your ServiceBeard
        administrator via <code>IMAP_POLL_INTERVAL_SECONDS</code> (default 60). Webhooks are not
        used for inbound email — polling is the only ingestion path.
      </p>

      <h2>Local development (GreenMail)</h2>
      <p>
        The docker-compose stack includes GreenMail for local testing. Use these settings for a
        support inbox:
      </p>
      <ul>
        <li>
          <strong>Support email:</strong> <code>support@mail.test</code>
        </li>
        <li>
          <strong>IMAP:</strong> <code>localhost:3143</code>, TLS off, user <code>support</code>,
          password <code>support</code>
        </li>
        <li>
          <strong>SMTP:</strong> <code>localhost:3025</code>, TLS off, user <code>support</code>,
          password <code>support</code>
        </li>
      </ul>
      <p>
        GreenMail uses the mailbox local-part as the login name (not the full email address). View
        messages in Roundcube at <code>http://localhost:8888</code>.
      </p>

      <h2>Troubleshooting</h2>
      <ul>
        <li>
          <strong>Auto-detect not offered:</strong> the domain is not in the preset list — enter
          server settings manually.
        </li>
        <li>
          <strong>IMAP works, SMTP fails:</strong> check SMTP port and TLS checkbox (try 587 with
          TLS off for STARTTLS, or 465 with TLS on).
        </li>
        <li>
          <strong>Authentication failed:</strong> confirm username is the full email address (except
          GreenMail local-part logins). For Gmail/iCloud/Yahoo, use an app password.
        </li>
        <li>
          <strong>Test passes but no issues created:</strong> mail connection is fine — check routing
          rules and the linked{" "}
          <Link to={DOC_PATHS.issueProviders}>issue provider</Link> configuration.
        </li>
        <li>
          <strong>Replies not threaded:</strong> ensure customers reply to the support address and
          that the original message <code>Message-ID</code> header was preserved.
        </li>
      </ul>
    </DocsLayout>
  );
}
