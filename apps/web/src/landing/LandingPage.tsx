import { Link } from "@tanstack/react-router";
import btn from "../components/Button.module.css";
import { GITHUB_REPO_URL, LANDING_FEATURES } from "./constants";
import { FeatureIcon, GithubIcon } from "./LandingIcons";
import styles from "./LandingPage.module.css";
import { ServiceBeardWordmark } from "./ServiceBeardWordmark";

export type LandingPageProps = {
  /** `app` — shown inside the SPA when signed out; `static` — exported HTML for Vercel. */
  variant?: "app" | "static";
  /** Show sign-in links on the marketing landing page. */
  showSignIn?: boolean;
  /** Logo image URL. Defaults to `/favicon.png`. */
  logoSrc?: string;
};

function SignInLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <Link to="/login" className={className}>
      {children}
    </Link>
  );
}

export function LandingPage({
  variant = "app",
  showSignIn = false,
  logoSrc = "/favicon.png",
}: LandingPageProps) {
  const staticMode = variant === "static";

  const signInBtn = (className: string) =>
    showSignIn &&
    (staticMode ? (
      <a href="/login" className={className}>
        Sign in
      </a>
    ) : (
      <SignInLink className={className}>Sign in</SignInLink>
    ));

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <img src={logoSrc} alt="" className={styles.heroLogo} width={72} height={72} />
          <ServiceBeardWordmark as="p" size="brand" />
          <h1 className={styles.headline}>Turn support mailboxes into tracked issues.</h1>
          <p className={styles.subtitle}>Open source — Self-hosted — Cloud coming soon.</p>
          <div className={styles.ctaRow}>
            {signInBtn([btn.button, btn.primary].join(" "))}
            <a
              href={GITHUB_REPO_URL}
              className={[btn.button, styles.githubBtn].join(" ")}
              rel="noopener noreferrer"
            >
              <GithubIcon />
              Star on GitHub
            </a>
          </div>
        </header>

        <section className={styles.section} aria-label="Features">
          <h2 className={styles.sectionTitle}>What it does</h2>
          <div className={styles.features}>
            {LANDING_FEATURES.map((feature) => (
              <article key={feature.title} className={styles.feature}>
                <div className={styles.featureIcon}>
                  <FeatureIcon name={feature.icon} />
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panels} aria-label="More details">
          <article className={[styles.panel, styles.panelHighlight].join(" ")}>
            <h2 className={styles.panelTitle}>Works with GitHub and GitLab, more to come</h2>
            <p className={styles.panelDesc}>
              First-class support for GitHub Cloud, GitLab Cloud and GitLab self-hosted instances.
              Webhooks plus polling keep comments flowing even when push delivery hiccups.
            </p>
            <ul className={styles.panelList}>
              <li>Per-project IMAP polling and SMTP outbound</li>
              <li>OIDC, GitHub, GitLab, passkey, and email login</li>
              <li>Helm chart for Kubernetes deployment</li>
            </ul>
          </article>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Managed cloud — coming soon</h2>
            <p className={styles.panelDesc}>
              We&apos;re building a hosted ServiceBeard so you can skip the infra and start
              syncing mail in minutes. Until then, clone the repo and run it yourself.
            </p>
            <a
              href={GITHUB_REPO_URL}
              className={[btn.button, btn.secondary].join(" ")}
              rel="noopener noreferrer"
            >
              <GithubIcon />
              Follow on GitHub
            </a>
          </article>
        </section>
      </div>
    </div>
  );
}
