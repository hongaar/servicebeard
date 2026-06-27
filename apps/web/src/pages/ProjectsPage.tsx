import { LimitReachedDialog } from "@extensions";
import { parseMailFromAddress } from "@servicebeard/shared/mail";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLoaderData, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ButtonLink } from "../components/ButtonLink";
import { Card } from "../components/Card";
import { CreateProjectWizard } from "../components/CreateProjectWizard";
import { EmptyIcon } from "../components/EmptyIcon";
import { Layout } from "../components/Layout";
import { ProviderLogo } from "../components/ProviderLogo";
import { TableRowActionLink } from "../components/TableRowAction";
import { api } from "../lib/api";
import { entitlementLimitMessage } from "../lib/entitlements";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import type { ProjectsLoaderData } from "../lib/loaderTypes";
import {
    defaultProjectSettingsForm,
    formToCreateInput,
    type ProjectSettingsFormValues,
} from "../lib/projectForm";
import styles from "../styles/pages.module.css";

export function ProjectsPage() {
  const { user, projects, entitlements, teamName } = useLoaderData({
    from: "/teams/$teamId/projects",
  }) as ProjectsLoaderData;
  const { teamId } = useParams({ from: "/teams/$teamId/projects" });
  const search = useSearch({ strict: false }) as {
    create?: string | boolean;
    wizardStep?: string;
    githubInstallationId?: string;
    githubAppError?: string;
  };
  const navigate = useNavigate();
  const router = useRouter();
  const { data: githubApp } = useQuery({
    queryKey: ["github-app-config"],
    queryFn: () => api.getGithubAppConfig(),
    staleTime: 60_000,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [form, setForm] = useState<ProjectSettingsFormValues>(defaultProjectSettingsForm);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const needsSubscription = Boolean(entitlements?.subscriptionRequired);
  const atProjectLimit = Boolean(entitlementLimitMessage("project", entitlements));

  const openCreate = () => {
    setForm(defaultProjectSettingsForm);
    setWizardStepIndex(0);
    setError("");
    setFieldErrors({});
    setShowCreate(true);
  };

  const tryOpenCreate = () => {
    if (atProjectLimit) {
      if (LimitReachedDialog && entitlements) {
        setLimitDialogOpen(true);
      } else {
        setError("Project limit reached");
      }
      setShowCreate(false);
      return;
    }
    openCreate();
  };

  useEffect(() => {
    const installationId = search.githubInstallationId;
    const shouldOpen =
      search.create ||
      installationId ||
      search.githubAppError ||
      search.wizardStep === "provider";

    if (!shouldOpen) return;

    if (atProjectLimit && !search.githubAppError) {
      if (LimitReachedDialog && entitlements) {
        setLimitDialogOpen(true);
      }
      return;
    }

    setShowCreate(true);
    if (search.wizardStep === "provider") {
      setWizardStepIndex(2);
    }
    if (installationId) {
      setForm((f) => ({
        ...f,
        provider: "github",
        providerGithubAuthType: "github_app",
        providerGithubInstallationId: installationId,
      }));
    }
    if (search.githubAppError) {
      const messages: Record<string, string> = {
        disabled: "GitHub App integration is not enabled on this server.",
        not_configured: "GitHub App is missing server credentials.",
        install_failed: "Could not start GitHub App installation.",
        invalid_callback: "GitHub App installation callback was invalid.",
        state_mismatch: "GitHub App installation state did not match.",
      };
      setError(messages[search.githubAppError] ?? "GitHub App installation failed.");
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, [
    navigate,
    search.create,
    search.githubAppError,
    search.githubInstallationId,
    search.wizardStep,
    teamId,
    atProjectLimit,
    entitlements,
  ]);

  const create = useMutation({
    mutationFn: () =>
      api.createProject(teamId, formToCreateInput(form, { githubAppEnabled: githubApp?.enabled })),
    onSuccess: async (project) => {
      await router.invalidate();
      navigate({
        to: "/teams/$teamId/projects/$projectId/$section",
        params: { teamId, projectId: project.id, section: "rules" },
      });
    },
    onError: (err) => handleMutationError(err, setError, setFieldErrors),
  });

  const update = (field: keyof ProjectSettingsFormValues, value: string | number | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => clearFieldError(prev, field));
    setError("");
  };

  const closeCreate = () => {
    setShowCreate(false);
    setWizardStepIndex(0);
    setForm(defaultProjectSettingsForm);
    setError("");
    setFieldErrors({});
  };

  const openProject = (projectId: string) => {
    navigate({
      to: "/teams/$teamId/projects/$projectId/$section",
      params: { teamId, projectId, section: "rules" },
    });
  };

  return (
    <Layout
      title="Projects"
      description="Each project connects a mailbox to your issue board. Open one to set up sync rules."
      user={user}
      teamId={teamId}
      teamName={teamName}
    >
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderText}>
          <h2 className={styles.sectionTitle}>All projects</h2>
          <p className={styles.sectionDescription}>
            {needsSubscription
              ? "Subscribe to create projects and sync mail for this team."
              : projects.length === 0
                ? "Create a project to start syncing email threads."
                : `${projects.length} project${projects.length === 1 ? "" : "s"} configured`}
          </p>
        </div>
        <Button onClick={() => (showCreate ? closeCreate() : tryOpenCreate())}>
          {showCreate ? "Cancel" : "New project"}
        </Button>
      </div>

      {error && <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>}

      {showCreate && (
        <Card title="New project" subtitle="Set up your mailbox and issue provider" className={styles.section}>
          <CreateProjectWizard
            teamId={teamId}
            values={form}
            onChange={update}
            onSubmit={() => create.mutate()}
            onCancel={closeCreate}
            submitLabel={create.isPending ? "Creating…" : "Create project"}
            isPending={create.isPending}
            fieldErrors={fieldErrors}
            initialStepIndex={wizardStepIndex}
            githubAppEnabled={githubApp?.enabled}
            onClearFieldError={(field) =>
              setFieldErrors((prev) => clearFieldError(prev, field))
            }
          />
        </Card>
      )}

      {projects.length === 0 && !showCreate ? (
        <div className={styles.empty}>
          <EmptyIcon icon={FolderPlus} />
          <p className={styles.emptyTitle}>No projects yet</p>
          <p className={styles.emptyHint}>
            {needsSubscription
              ? "Choose a plan on the billing page to create projects. You can still invite members and update team settings in the meantime."
              : "A project links your support inbox to GitLab so incoming mail becomes tracked issues automatically."}
          </p>
          {needsSubscription ? (
            <ButtonLink to="/teams/$teamId/billing" params={{ teamId }}>
              View plans
            </ButtonLink>
          ) : (
            <Button onClick={tryOpenCreate}>Create your first project</Button>
          )}
        </div>
      ) : projects.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mailbox</th>
                <th>Issues</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className={styles.tableRowClickable}
                  onClick={() => openProject(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openProject(p.id);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${p.name}`}
                >
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>
                    <span className={styles.inboxEmail}>
                      {parseMailFromAddress(p.smtpFrom)}
                    </span>
                  </td>
                  <td>
                    <span className={styles.issuesCell}>
                      <ProviderLogo provider={p.provider} />
                      <span className={styles.issuesRepo}>{p.providerProjectId}</span>
                    </span>
                  </td>
                  <td>
                    <span
                      className={[
                        styles.badge,
                        p.isActive ? styles.badgeActive : styles.badgeInactive,
                      ].join(" ")}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={styles.tableActions}>
                    <TableRowActionLink
                      label="Open"
                      onActivate={(e) => e.stopPropagation()}
                      link={{
                        to: "/teams/$teamId/projects/$projectId/$section",
                        params: { teamId, projectId: p.id, section: "rules" },
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {LimitReachedDialog && entitlements && (
        <LimitReachedDialog
          open={limitDialogOpen}
          onOpenChange={setLimitDialogOpen}
          resource="project"
          entitlements={entitlements}
          teamId={teamId}
        />
      )}
    </Layout>
  );
}
