import { Link, useRouterState } from "@tanstack/react-router";
import { DOC_PATHS } from "../lib/docs";
import styles from "../styles/docs.module.css";

const NAV = [
  { path: DOC_PATHS.index, label: "Overview" },
  { path: DOC_PATHS.mailbox, label: "Mailbox configuration" },
  {
    path: DOC_PATHS.issueProviders,
    label: "Issue providers",
    children: [
      { path: DOC_PATHS.github, label: "GitHub" },
      { path: DOC_PATHS.gitlab, label: "GitLab" },
    ],
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === DOC_PATHS.index) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocsLayout({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link to="/" className={styles.brand}>
            <img
              src="/favicon.png"
              alt=""
              className={styles.brandLogo}
              width={36}
              height={36}
            />
            <span className={styles.brandName}>ServiceBeard</span>
          </Link>
          <Link to="/" className={styles.homeLink}>
            Back to app
          </Link>
        </header>

        <div className={styles.layout}>
          <nav className={styles.nav} aria-label="Documentation">
            <p className={styles.navTitle}>Documentation</p>
            <ul className={styles.navList}>
              {NAV.map((item) => (
                <li key={item.path} className={styles.navItem}>
                  <Link
                    to={item.path}
                    className={[
                      styles.navLink,
                      isActive(pathname, item.path) ? styles.navLinkActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {item.label}
                  </Link>
                  {"children" in item && item.children && (
                    <ul className={styles.navSublist}>
                      {item.children.map((child) => (
                        <li key={child.path} className={styles.navItem}>
                          <Link
                            to={child.path}
                            className={[
                              styles.navLink,
                              isActive(pathname, child.path) ? styles.navLinkActive : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <article className={styles.content}>
            <h1 className={styles.title}>{title}</h1>
            {lead && <p className={styles.lead}>{lead}</p>}
            <div className={styles.prose}>{children}</div>
          </article>
        </div>
      </div>
    </div>
  );
}
