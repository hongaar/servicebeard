import {
  extensionAdminBreadcrumbs,
  extensionAdminNavItems,
  extensionAppFooterLinks,
  extensionTeamNavItems,
  extensionTeamPageIcon,
  isExtensionTeamNavActive,
} from "@extensions";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { iconMd } from "../lib/icons";
import {
  NAV_ICONS,
  PROJECT_SECTION_LABELS,
  homePageIcon,
  teamPageIcon,
  type NavIconKey,
  type ProjectSection,
} from "../lib/navigation";
import {
  BackLink,
  BreadcrumbProjectPicker,
  BreadcrumbTeamPicker,
} from "./ContextPicker";
import { GlobalSearch } from "./GlobalSearch";
import styles from "./Layout.module.css";
import { ProviderLogo } from "./ProviderLogo";
import { UserMenu } from "./UserMenu";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  user: { email: string; name: string | null; isAdmin?: boolean };
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
    kind?: "team" | "project";
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
  section = "overview",
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
  const adminNavItems = user?.isAdmin ? extensionAdminNavItems() : [];
  const appFooterLinks = extensionAppFooterLinks();

  const isDashboard = pathname === "/";
  const isAccount = pathname === "/account";
  const isAdminStatus = pathname === "/admin/status";
  const isAdminAuditLog = pathname === "/admin/audit-log";
  const isTeamMembers = teamId && pathname === `/teams/${teamId}/members`;
  const isTeamSettings = teamId && pathname === `/teams/${teamId}/settings`;
  const isProjectsList = teamId && pathname === `/teams/${teamId}/projects`;
  const isProjectContext = !!(teamId && projectId);

  const navLinkClass = (active: boolean) =>
    [styles.navLink, active ? styles.navLinkActive : ""]
      .filter(Boolean)
      .join(" ");

  const sidebarContext = isProjectContext
    ? "project"
    : teamId
      ? "team"
      : "home";

  const sidebarSectionLabel =
    sidebarContext === "project"
      ? "Project"
      : sidebarContext === "team"
        ? "Team"
        : "Home";

  type BreadcrumbItem = {
    label: string;
    to?: string;
    params?: Record<string, string>;
    icon?: NavIconKey;
    Icon?: LucideIcon;
    picker?: "team" | "project";
  };

  const breadcrumbs: BreadcrumbItem[] = (() => {
    const homeCrumb: BreadcrumbItem = { label: "Home", to: "/", icon: "home" };

    if (pathname.startsWith("/admin/")) {
      const adminCrumbs = extensionAdminBreadcrumbs(pathname, title);
      if (adminCrumbs.length > 0) {
        return [homeCrumb, ...adminCrumbs];
      }
    }

    if (sidebarContext === "home") {
      return [homeCrumb, { label: title, icon: homePageIcon(pathname) }];
    }

    if (sidebarContext === "team" && teamId) {
      const pageIcon = teamPageIcon(pathname, teamId);
      const extensionIcon = pageIcon
        ? undefined
        : extensionTeamPageIcon(pathname, teamId);
      const items: BreadcrumbItem[] = [
        {
          label: teamName ?? "Team",
          ...(pageIcon !== "projects" && {
            to: "/teams/$teamId/projects",
            params: { teamId },
          }),
          icon: "team",
          picker: "team",
        },
      ];
      if (pageIcon || extensionIcon) {
        items.push({ label: title, icon: pageIcon, Icon: extensionIcon });
      }
      return [homeCrumb, ...items];
    }

    if (sidebarContext === "project" && teamId && projectId) {
      const items: BreadcrumbItem[] = [
        {
          label: teamName ?? "Team",
          to: "/teams/$teamId/projects",
          params: { teamId },
          icon: "team",
          picker: "team",
        },
      ];
      items.push({
        label: projectName ?? "Project",
        ...(section !== "overview" && {
          to: "/teams/$teamId/projects/$projectId/$section",
          params: { teamId, projectId, section: "overview" },
        }),
        icon: "project",
        picker: "project",
      });
      items.push({ label: PROJECT_SECTION_LABELS[section], icon: section });
      return [homeCrumb, ...items];
    }

    return [];
  })();

  const breadcrumbIcon = (item: Pick<BreadcrumbItem, "icon" | "Icon">) => {
    if (item.Icon) {
      const Icon = item.Icon;
      return <Icon {...iconMd} />;
    }
    if (!item.icon) return null;
    const Icon = NAV_ICONS[item.icon];
    return <Icon {...iconMd} />;
  };

  return (
    <div className={styles.app}>
      <header className={styles.navbar}>
        <div className={styles.navbarLeft}>
          <Link to="/" className={styles.brand}>
            <img
              src="/favicon.png"
              alt=""
              className={styles.brandLogo}
              width={36}
              height={36}
            />
            <span className={styles.brandName}>
              Service<span className={styles.brandAccent}>Beard</span>
            </span>
          </Link>
          <GlobalSearch
            context={{
              teamId,
              teamName,
              projectId,
              projectName,
              section,
              isAdmin: user.isAdmin,
            }}
          />
        </div>

        <UserMenu user={user} />
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Section navigation">
          <nav className={styles.nav}>
            {sidebarContext === "home" && (
              <>
                <p className={styles.navSection}>{sidebarSectionLabel}</p>
                <Link
                  to="/"
                  className={navLinkClass(isDashboard)}
                  title="Teams"
                >
                  <NavIcon>
                    <NAV_ICONS.teams {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Teams</span>
                </Link>
                <Link
                  to="/account"
                  className={navLinkClass(isAccount)}
                  title="Account"
                >
                  <NavIcon>
                    <NAV_ICONS.account {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Account</span>
                </Link>
                {user?.isAdmin && (
                  <>
                    <Link
                      to="/admin/status"
                      className={navLinkClass(isAdminStatus)}
                    >
                      <NavIcon>
                        <NAV_ICONS.adminStatus {...iconMd} />
                      </NavIcon>
                      System status
                    </Link>
                    <Link
                      to="/admin/audit-log"
                      className={navLinkClass(isAdminAuditLog)}
                    >
                      <NavIcon>
                        <NAV_ICONS.adminAuditLog {...iconMd} />
                      </NavIcon>
                      Audit log
                    </Link>
                  </>
                )}
                {adminNavItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={navLinkClass(
                      pathname === item.to ||
                        pathname.startsWith(`${item.to}/`),
                    )}
                  >
                    <NavIcon>
                      <item.icon {...iconMd} />
                    </NavIcon>
                    {item.label}
                  </Link>
                ))}
              </>
            )}

            {sidebarContext === "team" && teamId && (
              <>
                <p className={styles.navSection}>{sidebarSectionLabel}</p>
                <Link
                  to="/teams/$teamId/projects"
                  params={{ teamId }}
                  className={navLinkClass(!!isProjectsList)}
                  title="Projects"
                >
                  <NavIcon>
                    <NAV_ICONS.projects {...iconMd} />
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
                    <NAV_ICONS.members {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Members</span>
                </Link>
                {extraTeamNavItems.map((item) => {
                  if (item.visible === false) return null;
                  const Icon = item.icon;
                  const active = isExtensionTeamNavActive(
                    pathname,
                    teamId,
                    item,
                  );
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
                    <NAV_ICONS.teamSettings {...iconMd} />
                  </NavIcon>
                  <span className={styles.navLabel}>Settings</span>
                </Link>
              </>
            )}

            {sidebarContext === "project" && teamId && projectId && (
              <>
                <p className={styles.navSection}>{sidebarSectionLabel}</p>
                {(
                  [
                    ["overview", "Overview"],
                    ["rules", "Rules"],
                    ["conversations", "Conversations"],
                    ["status", "Status"],
                    ["templates", "Templates"],
                    ["settings", "Settings"],
                  ] as const
                ).map(([key, label]) => {
                  const Icon = NAV_ICONS[key];
                  return (
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
                  );
                })}
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
          <div className={styles.mainBody}>
            {breadcrumbs.length > 0 && (
              <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                <ol className={styles.breadcrumbList}>
                  {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    const asLink = !!(item.to && !isLast);
                    const icon =
                      item.icon || item.Icon ? breadcrumbIcon(item) : undefined;

                    return (
                      <li
                        key={`${item.label}-${index}`}
                        className={styles.breadcrumbItem}
                      >
                        {item.picker === "team" ? (
                          <BreadcrumbTeamPicker
                            label={item.label}
                            to={item.to}
                            params={item.params}
                            asLink={asLink}
                            ariaCurrent={isLast}
                            icon={icon}
                            teams={teams}
                            teamId={teamId}
                            linkClassName={styles.breadcrumbLink}
                            currentClassName={styles.breadcrumbCurrent}
                            iconClassName={styles.breadcrumbIcon}
                          />
                        ) : item.picker === "project" && teamId ? (
                          <BreadcrumbProjectPicker
                            label={item.label}
                            to={item.to}
                            params={item.params}
                            asLink={asLink}
                            ariaCurrent={isLast}
                            icon={icon}
                            projects={projects}
                            teamId={teamId}
                            projectId={projectId}
                            section={section}
                            linkClassName={styles.breadcrumbLink}
                            currentClassName={styles.breadcrumbCurrent}
                            iconClassName={styles.breadcrumbIcon}
                          />
                        ) : item.to && !isLast ? (
                          <Link
                            to={item.to}
                            params={item.params}
                            className={styles.breadcrumbLink}
                          >
                            {icon && (
                              <span className={styles.breadcrumbIcon}>
                                {icon}
                              </span>
                            )}
                            {item.label}
                          </Link>
                        ) : (
                          <span
                            className={styles.breadcrumbCurrent}
                            aria-current={isLast ? "page" : undefined}
                          >
                            {icon && (
                              <span className={styles.breadcrumbIcon}>
                                {icon}
                              </span>
                            )}
                            {item.label}
                          </span>
                        )}
                        {!isLast && (
                          <span
                            className={styles.breadcrumbSeparator}
                            aria-hidden
                          >
                            /
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>{title}</h1>
              {inboxEmail && (
                <p className={styles.pageInbox}>
                  <span className={styles.pageInboxLabel}>
                    New tickets arrive at
                  </span>
                  <code className={styles.pageInboxEmail}>{inboxEmail}</code>
                  {issueLink && (
                    <>
                      <span className={styles.pageInboxLabel}>
                        Issues tracked in
                      </span>
                      <a
                        href={issueLink.href}
                        className={styles.pageIssueLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ProviderLogo provider={issueLink.provider} />
                        {issueLink.provider.toLowerCase() === "linear" &&
                        issueLink.kind ? (
                          <span
                            className={styles.pageIssueKind}
                            data-kind={issueLink.kind}
                          >
                            {issueLink.kind === "team" ? "Team" : "Project"}
                          </span>
                        ) : null}
                        <span>{issueLink.label}</span>
                      </a>
                    </>
                  )}
                </p>
              )}
              {description && (
                <p className={styles.pageDescription}>{description}</p>
              )}
            </div>
            {children}
          </div>
          {appFooterLinks.length > 0 && (
            <footer className={styles.appFooter}>
              <nav
                className={styles.appFooterLinks}
                aria-label="Legal and product"
              >
                {appFooterLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={styles.appFooterLink}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
