import {
    extensionTeamNavItems,
    isExtensionTeamNavActive,
} from "@extensions";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
    Activity,
    FileText,
    Folder,
    LayoutDashboard,
    Settings,
    SlidersHorizontal,
    Users,
} from "lucide-react";
import { api } from "../lib/api";
import { iconMd } from "../lib/icons";
import type { ProjectSection } from "../lib/navigation";
import { BackLink, ProjectPicker, TeamPicker } from "./ContextPicker";
import styles from "./Layout.module.css";
import { ProviderLogo } from "./ProviderLogo";
import { UserMenu } from "./UserMenu";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  user: { email: string; name: string | null };
  teamId?: string;
  teamName?: string;
  projectId?: string;
  projectName?: string;
  section?: ProjectSection;
  inboxEmail?: string;
  issueLink?: {
    provider: string;
    label: string;
    href: string;
  };
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return <span className={styles.navIcon}>{children}</span>;
}

export function Layout({
  children,
  title,
  description,
  user,
  teamId,
  teamName,
  projectId,
  projectName,
  section = "rules",
  inboxEmail,
  issueLink,
}: LayoutProps) {
  const router = useRouterState();
  const pathname = router.location.pathname;

  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.getTeams(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects", teamId],
    queryFn: () => api.getProjects(teamId!),
    enabled: !!teamId,
  });

  const teams = teamsData?.teams ?? [];
  const projects = projectsData?.projects ?? [];
  const extraTeamNavItems = teamId ? extensionTeamNavItems(teamId) : [];

  const isDashboard = pathname === "/";
  const isTeamMembers = teamId && pathname === `/teams/${teamId}/members`;
  const isTeamSettings = teamId && pathname === `/teams/${teamId}/settings`;
  const isProjectsList = teamId && pathname === `/teams/${teamId}/projects`;
  const isProjectContext = !!(teamId && projectId);

  const navLinkClass = (active: boolean) =>
    [styles.navLink, active ? styles.navLinkActive : ""].filter(Boolean).join(" ");

  const sidebarContext = isProjectContext
    ? "project"
    : teamId
      ? "team"
      : "home";

  return (
    <div className={styles.app}>
      <header className={styles.navbar}>
        <div className={styles.navbarLeft}>
          <Link to="/" className={styles.brand}>
            <img src="/favicon.png" alt="" className={styles.brandLogo} width={36} height={36} />
            <span className={styles.brandName}>
              Service<span className={styles.brandAccent}>Beard</span>
            </span>
          </Link>

          <div className={styles.pickers}>
            <TeamPicker teams={teams} teamId={teamId} />
            {teamId && (
              <ProjectPicker
                projects={projects}
                teamId={teamId}
                projectId={projectId}
                section={section}
              />
            )}
          </div>
        </div>

        <UserMenu user={user} />
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Section navigation">
          <nav className={styles.nav}>
            {sidebarContext === "home" && (
              <>
                <p className={styles.navSection}>Home</p>
                <Link to="/" className={navLinkClass(isDashboard)} title="Dashboard">
                  <NavIcon>
                    <LayoutDashboard {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Dashboard</span>
                </Link>
              </>
            )}

            {sidebarContext === "team" && teamId && (
              <>
                <p className={styles.navSection}>{teamName ?? "Team"}</p>
                <Link
                  to="/teams/$teamId/projects"
                  params={{ teamId }}
                  className={navLinkClass(!!isProjectsList)}
                  title="Projects"
                >
                  <NavIcon>
                    <Folder {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Projects</span>
                </Link>
                <Link
                  to="/teams/$teamId/members"
                  params={{ teamId }}
                  className={navLinkClass(!!isTeamMembers)}
                  title="Members"
                >
                  <NavIcon>
                    <Users {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Members</span>
                </Link>
                {extraTeamNavItems.map((item) => {
                  if (item.visible === false) return null;
                  const Icon = item.icon;
                  const active = isExtensionTeamNavActive(pathname, teamId, item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      params={item.params ?? { teamId }}
                      className={navLinkClass(active)}
                      title={item.label}
                    >
                      <NavIcon>
                        <Icon {...iconMd} />
                      </NavIcon>
                      <span className={styles.navLabel}>{item.label}</span>
                    </Link>
                  );
                })}
                <Link
                  to="/teams/$teamId/settings"
                  params={{ teamId }}
                  className={navLinkClass(!!isTeamSettings)}
                  title="Settings"
                >
                  <NavIcon>
                    <Settings {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Settings</span>
                </Link>
              </>
            )}

            {sidebarContext === "project" && teamId && projectId && (
              <>
                <p className={styles.navSection}>{projectName ?? "Project"}</p>
                {(
                  [
                    ["rules", "Rules", SlidersHorizontal],
                    ["status", "Status", Activity],
                    ["templates", "Templates", FileText],
                    ["settings", "Settings", Settings],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <Link
                    key={key}
                    to="/teams/$teamId/projects/$projectId/$section"
                    params={{ teamId, projectId, section: key }}
                    className={navLinkClass(section === key)}
                    title={label}
                  >
                    <NavIcon>
                      <Icon {...iconMd} />
                    </NavIcon>
                    <span className={styles.navLabel}>{label}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className={styles.sidebarFooter}>
            {sidebarContext === "team" && (
              <BackLink to="/">Back to dashboard</BackLink>
            )}
            {sidebarContext === "project" && teamId && (
              <BackLink to="/teams/$teamId/projects" params={{ teamId }}>
                Back to {teamName ?? "team"}
              </BackLink>
            )}
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{title}</h1>
            {inboxEmail && (
              <p className={styles.pageInbox}>
                <span className={styles.pageInboxLabel}>New tickets arrive at</span>
                <code className={styles.pageInboxEmail}>{inboxEmail}</code>
                {issueLink && (
                  <>
                    <span className={styles.pageInboxLabel}>Issues tracked in</span>
                    <a
                      href={issueLink.href}
                      className={styles.pageIssueLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ProviderLogo provider={issueLink.provider} />
                      <span>{issueLink.label}</span>
                    </a>
                  </>
                )}
              </p>
            )}
            {description && <p className={styles.pageDescription}>{description}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
