import { Link, useRouterState } from "@tanstack/react-router";
import { api } from "../lib/api";
import { Button } from "./Button";
import styles from "./Layout.module.css";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  user: { email: string; name: string | null };
  teamId?: string;
  teamName?: string;
}

function NavIcon({ name }: { name: "home" | "team" | "projects" }) {
  const icons = {
    home: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
    team: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    projects: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" />
      </svg>
    ),
  };
  return <span className={styles.navIcon}>{icons[name]}</span>;
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function Layout({ children, title, description, user, teamId, teamName }: LayoutProps) {
  const router = useRouterState();
  const pathname = router.location.pathname;

  const handleLogout = async () => {
    await api.logout();
    window.location.href = "/login";
  };

  const isDashboard = pathname === "/";
  const isTeamPage = teamId && pathname === `/teams/${teamId}`;
  const isProjectsList = teamId && pathname === `/teams/${teamId}/projects`;
  const isProjectDetail = teamId && pathname.includes("/projects/") && !isProjectsList;

  const navLinkClass = (active: boolean) =>
    [styles.navLink, active ? styles.navLinkActive : ""].filter(Boolean).join(" ");

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>Serviceboard</span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <p className={styles.navSection}>Overview</p>
          <Link to="/" className={navLinkClass(isDashboard)}>
            <NavIcon name="home" />
            Dashboard
          </Link>

          {teamId && (
            <>
              <p className={styles.navSection}>{teamName ?? "Team"}</p>
              <Link
                to="/teams/$teamId"
                params={{ teamId }}
                className={navLinkClass(!!isTeamPage)}
              >
                <NavIcon name="team" />
                Members
              </Link>
              <Link
                to="/teams/$teamId/projects"
                params={{ teamId }}
                className={navLinkClass(!!(isProjectsList || isProjectDetail))}
              >
                <NavIcon name="projects" />
                Projects
              </Link>
            </>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.sidebarHint}>
            {teamId
              ? "Pick a project to configure mail sync rules."
              : "Select a team to manage projects and members."}
          </p>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topBar}>
          <div className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link to="/" className={styles.breadcrumbLink}>
              Home
            </Link>
            {teamId && teamName && (
              <>
                <span className={styles.breadcrumbSep} aria-hidden>/</span>
                <Link
                  to="/teams/$teamId"
                  params={{ teamId }}
                  className={styles.breadcrumbLink}
                >
                  {teamName}
                </Link>
              </>
            )}
            {isProjectsList && (
              <>
                <span className={styles.breadcrumbSep} aria-hidden>/</span>
                <span className={styles.breadcrumbCurrent}>Projects</span>
              </>
            )}
            {isProjectDetail && (
              <>
                <span className={styles.breadcrumbSep} aria-hidden>/</span>
                <Link
                  to="/teams/$teamId/projects"
                  params={{ teamId }}
                  className={styles.breadcrumbLink}
                >
                  Projects
                </Link>
                <span className={styles.breadcrumbSep} aria-hidden>/</span>
                <span className={styles.breadcrumbCurrent}>{title}</span>
              </>
            )}
          </div>

          <div className={styles.userArea}>
            <div className={styles.userInfo}>
              <span className={styles.avatar} aria-hidden>
                {getInitials(user.name, user.email)}
              </span>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{user.name ?? user.email.split("@")[0]}</span>
                <span className={styles.userEmail}>{user.email}</span>
              </div>
            </div>
            <Button variant="ghost" size="small" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{title}</h1>
            {description && <p className={styles.pageDescription}>{description}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
