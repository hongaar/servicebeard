import { Link, useRouterState } from "@tanstack/react-router";
import { api } from "../lib/api";
import { Button } from "./Button";
import styles from "./Layout.module.css";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  user: { email: string; name: string | null };
  teamId?: string;
}

export function Layout({ children, title, user, teamId }: LayoutProps) {
  const router = useRouterState();

  const handleLogout = async () => {
    await api.logout();
    window.location.href = "/login";
  };

  const isActive = (path: string) =>
    router.location.pathname === path ? styles.navLinkActive : "";

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>Serviceboard</div>
        <nav className={styles.nav}>
          <Link to="/" className={[styles.navLink, isActive("/")].join(" ")}>
            Dashboard
          </Link>
          {teamId && (
            <>
              <Link
                to="/teams/$teamId"
                params={{ teamId }}
                className={[
                  styles.navLink,
                  isActive(`/teams/${teamId}`) &&
                  !router.location.pathname.includes("/projects")
                    ? styles.navLinkActive
                    : "",
                ].join(" ")}
              >
                Team
              </Link>
              <Link
                to="/teams/$teamId/projects"
                params={{ teamId }}
                className={[
                  styles.navLink,
                  router.location.pathname.includes("/projects")
                    ? styles.navLinkActive
                    : "",
                ].join(" ")}
              >
                Projects
              </Link>
            </>
          )}
        </nav>
      </aside>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>{title}</h1>
          <div className={styles.user}>
            <span>{user.name ?? user.email}</span>
            <Button variant="secondary" size="small" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
