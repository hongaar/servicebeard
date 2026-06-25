import { providerIssuesWebUrl } from "@servicebeard/shared";
import { parseMailFromAddress } from "@servicebeard/shared/mail";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLoaderData, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { MessagesSquare, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DestructiveConfirmDialog } from "../components/DestructiveConfirmDialog";
import { EmptyIcon } from "../components/EmptyIcon";
import { Layout } from "../components/Layout";
import { ProjectSettingsForm } from "../components/ProjectSettingsForm";
import { ProjectTemplatesForm } from "../components/ProjectTemplatesForm";
import { RuleActionsCell } from "../components/RuleActionsCell";
import { RuleForm } from "../components/RuleForm";
import { SyncErrorDetailDialog } from "../components/SyncErrorDetailDialog";
import { TableRowAction } from "../components/TableRowAction";
import { ThreadDetailDialog } from "../components/ThreadDetailDialog";
import { api, type CreateRuleInput, type ProjectSyncError, type Rule } from "../lib/api";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import type { ProjectSection } from "../lib/navigation";
import {
    formToUpdateInput,
    projectToSettingsForm,
    type ProjectSettingsFormValues,
} from "../lib/projectForm";
import {
    formToTemplatesUpdateInput,
    projectToTemplatesForm,
    type ProjectTemplatesFormValues,
} from "../lib/projectTemplatesForm";
import { formatRuleMatch } from "../lib/ruleDisplay";
import styles from "../styles/pages.module.css";

const SECTION_INFO: Record<ProjectSection, { description: string }> = {
  rules: {
    description: "Define how incoming emails are matched and what happens on your issue board.",
  },
  status: {
    description:
      "Conversations, plus recent mailbox and issue-provider errors for this project.",
  },
  templates: {
    description: "Email and issue tracker templates for customer-facing messages.",
  },
  settings: {
    description: "Mailbox credentials, provider config, and project options.",
  },
};

function ruleToFormInput(rule: Rule): CreateRuleInput {
  return {
    name: rule.name,
    priority: rule.priority,
    isEnabled: rule.isEnabled,
    matchSender: rule.matchSender ?? "",
    matchSubject: rule.matchSubject ?? "",
    matchBody: rule.matchBody ?? "",
    actionCreateIssue: rule.actionCreateIssue,
    actionStatus: rule.actionStatus,
    actionLabels: rule.actionLabels,
    actionAssigneeId: rule.actionAssigneeId,
  };
}

export function ProjectDetailPage() {
  const { user, project, threads, syncErrors, teamName, section } = useLoaderData({
    from: "/teams/$teamId/projects/$projectId/$section",
  });
  const { teamId, projectId } = useParams({ from: "/teams/$teamId/projects/$projectId/$section" });
  const search = useSearch({ strict: false }) as {
    githubInstallationId?: string;
    githubAppError?: string;
  };
  const navigate = useNavigate();
  const { data: githubApp } = useQuery({
    queryKey: ["github-app-config"],
    queryFn: () => api.getGithubAppConfig(),
    staleTime: 60_000,
  });
  const providerOptions = useQuery({
    queryKey: ["provider-options", teamId, projectId],
    queryFn: () => api.getProviderOptions(teamId, projectId),
    enabled: section === "rules",
    staleTime: 60_000,
  });
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [settingsForm, setSettingsForm] = useState<ProjectSettingsFormValues>(() =>
    projectToSettingsForm(project),
  );
  const [templatesForm, setTemplatesForm] = useState<ProjectTemplatesFormValues>(() =>
    projectToTemplatesForm(project),
  );
  const [settingsError, setSettingsError] = useState("");
  const [templatesError, setTemplatesError] = useState("");
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<Record<string, string>>({});
  const [templatesFieldErrors, setTemplatesFieldErrors] = useState<Record<string, string>>({});
  const [ruleFormError, setRuleFormError] = useState("");
  const [ruleFieldErrors, setRuleFieldErrors] = useState<Record<string, string>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadLabel, setSelectedThreadLabel] = useState("");
  const [selectedSyncErrorId, setSelectedSyncErrorId] = useState<string | null>(null);

  const selectedSyncError =
    syncErrors.find((error) => error.id === selectedSyncErrorId) ?? null;

  useEffect(() => {
    setSettingsForm(projectToSettingsForm(project));
    setTemplatesForm(projectToTemplatesForm(project));
    setSettingsError("");
    setTemplatesError("");
    setSettingsFieldErrors({});
    setTemplatesFieldErrors({});
    setShowRuleForm(false);
    setEditingRuleId(null);
    setRuleFormError("");
    setRuleFieldErrors({});
    setSelectedThreadId(null);
    setSelectedThreadLabel("");
    setSelectedSyncErrorId(null);
    setShowDeleteDialog(false);
    setDeleteError("");
  }, [project.id]);

  useEffect(() => {
    if (!search.githubInstallationId && !search.githubAppError) return;

    if (section !== "settings") {
      navigate({
        to: "/teams/$teamId/projects/$projectId/$section",
        params: { teamId, projectId, section: "settings" },
        search: {
          githubInstallationId: search.githubInstallationId,
          githubAppError: search.githubAppError,
        },
      });
      return;
    }

    if (search.githubInstallationId) {
      setSettingsForm((f) => ({
        ...f,
        provider: "github",
        providerGithubAuthType: "github_app",
        providerGithubInstallationId: search.githubInstallationId!,
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
      setSettingsError(messages[search.githubAppError] ?? "GitHub App installation failed.");
    }

    window.history.replaceState({}, "", window.location.pathname);
  }, [
    navigate,
    projectId,
    search.githubAppError,
    search.githubInstallationId,
    section,
    teamId,
  ]);

  const createRule = useMutation({
    mutationFn: (data: Parameters<typeof api.createRule>[2]) =>
      api.createRule(teamId, project.id, data),
    onSuccess: () => window.location.reload(),
    onError: (err) => handleMutationError(err, setRuleFormError, setRuleFieldErrors),
  });

  const updateRule = useMutation({
    mutationFn: ({ ruleId, data }: { ruleId: string; data: CreateRuleInput }) =>
      api.updateRule(teamId, project.id, ruleId, data),
    onSuccess: () => window.location.reload(),
    onError: (err) => handleMutationError(err, setRuleFormError, setRuleFieldErrors),
  });

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => api.deleteRule(teamId, project.id, ruleId),
    onSuccess: () => window.location.reload(),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      api.updateProject(
        teamId,
        project.id,
        formToUpdateInput(settingsForm, { githubAppEnabled: githubApp?.enabled }),
      ),
    onSuccess: () => window.location.reload(),
    onError: (err) => handleMutationError(err, setSettingsError, setSettingsFieldErrors),
  });

  const saveTemplates = useMutation({
    mutationFn: () => api.updateProject(teamId, project.id, formToTemplatesUpdateInput(templatesForm)),
    onSuccess: () => window.location.reload(),
    onError: (err) => handleMutationError(err, setTemplatesError, setTemplatesFieldErrors),
  });

  const deleteProject = useMutation({
    mutationFn: () => api.deleteProject(teamId, project.id),
    onSuccess: () => {
      setShowDeleteDialog(false);
      setDeleteError("");
      navigate({
        to: "/teams/$teamId/projects",
        params: { teamId },
        replace: true,
      });
    },
    onError: (err) => {
      handleMutationError(err, setDeleteError, (_errors) => {});
      setShowDeleteDialog(false);
    },
  });

  const dismissSyncError = useMutation({
    mutationFn: (errorId: string) => api.dismissSyncError(teamId, project.id, errorId),
    onSuccess: () => window.location.reload(),
  });

  const dismissAllSyncErrors = useMutation({
    mutationFn: () => api.dismissAllSyncErrors(teamId, project.id),
    onSuccess: () => window.location.reload(),
  });

  const updateSettings = (
    field: keyof ProjectSettingsFormValues,
    value: string | number | boolean,
  ) => {
    setSettingsForm((f) => ({ ...f, [field]: value }));
    setSettingsFieldErrors((prev) => clearFieldError(prev, field));
    setSettingsError("");
  };

  const updateTemplates = (
    field: keyof ProjectTemplatesFormValues,
    value: string | boolean,
  ) => {
    setTemplatesForm((f) => ({ ...f, [field]: value }));
    setTemplatesFieldErrors((prev) => clearFieldError(prev, field));
    setTemplatesError("");
  };

  const clearRuleFieldError = (field: string) => {
    setRuleFieldErrors((prev) => clearFieldError(prev, field));
    setRuleFormError("");
  };

  const openThread = (threadId: string, issueLabel: string) => {
    setSelectedThreadId(threadId);
    setSelectedThreadLabel(issueLabel);
  };

  const openRuleEditor = (ruleId: string) => {
    setShowRuleForm(false);
    setEditingRuleId(ruleId);
  };

  const syncErrorCategoryLabel = (category: ProjectSyncError["category"]) =>
    category === "mail" ? "Mailbox" : "Issue provider";

  const editingRule = editingRuleId
    ? project.rules.find((rule) => rule.id === editingRuleId)
    : undefined;

  return (
    <Layout
      title={project.name}
      description={SECTION_INFO[section].description}
      user={user}
      teamId={teamId}
      teamName={teamName}
      projectId={projectId}
      projectName={project.name}
      section={section}
      inboxEmail={parseMailFromAddress(project.smtpFrom)}
      issueLink={{
        provider: project.provider,
        label: project.providerProjectId,
        href: providerIssuesWebUrl(
          project.provider,
          project.providerBaseUrl,
          project.providerProjectId,
        ),
      }}
    >
      {section === "rules" && (
        <>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderText}>
              <h2 className={styles.sectionTitle}>Automation rules</h2>
              <p className={styles.sectionDescription}>
                Rules run in priority order. The first match wins.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingRuleId(null);
                setShowRuleForm(!showRuleForm);
              }}
            >
              {showRuleForm ? "Cancel" : "Add rule"}
            </Button>
          </div>

          {showRuleForm && (
            <RuleForm
              key="new-rule"
              teamId={teamId}
              projectId={project.id}
              title="New rule"
              submitLabel={createRule.isPending ? "Saving…" : "Save rule"}
              isPending={createRule.isPending}
              formError={ruleFormError}
              fieldErrors={ruleFieldErrors}
              onClearFieldError={clearRuleFieldError}
              onCancel={() => setShowRuleForm(false)}
              onSubmit={(data) => createRule.mutate(data)}
            />
          )}

          {editingRule && (
            <RuleForm
              key={editingRule.id}
              teamId={teamId}
              projectId={project.id}
              initial={ruleToFormInput(editingRule)}
              title={`Edit rule: ${editingRule.name}`}
              submitLabel={updateRule.isPending ? "Saving…" : "Save changes"}
              isPending={updateRule.isPending}
              formError={ruleFormError}
              fieldErrors={ruleFieldErrors}
              onClearFieldError={clearRuleFieldError}
              onCancel={() => setEditingRuleId(null)}
              onDelete={() => deleteRule.mutate(editingRule.id)}
              isDeleting={deleteRule.isPending}
              onSubmit={(data) => updateRule.mutate({ ruleId: editingRule.id, data })}
            />
          )}

          {project.rules.length === 0 && !showRuleForm ? (
            <div className={styles.empty}>
              <EmptyIcon icon={SlidersHorizontal} />
              <p className={styles.emptyTitle}>No rules yet</p>
              <p className={styles.emptyHint}>
                Add a rule to tell Servicebeard how to handle incoming emails — for example,
                create an issue when mail arrives from a VIP sender.
              </p>
              <Button onClick={() => setShowRuleForm(true)}>Add your first rule</Button>
            </div>
          ) : project.rules.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Priority</th>
                    <th>Match</th>
                    <th>Actions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {project.rules
                    .sort((a, b) => a.priority - b.priority)
                    .map((rule) => (
                      <tr
                        key={rule.id}
                        className={styles.tableRowClickable}
                        onClick={() => openRuleEditor(rule.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openRuleEditor(rule.id);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Edit rule ${rule.name}`}
                        aria-current={editingRuleId === rule.id ? "true" : undefined}
                      >
                        <td>
                          <strong>{rule.name}</strong>
                          {!rule.isEnabled && (
                            <span
                              className={[styles.badge, styles.badgeInactive].join(" ")}
                              style={{ marginLeft: "0.5rem" }}
                            >
                              Disabled
                            </span>
                          )}
                        </td>
                        <td>{rule.priority}</td>
                        <td className={styles.ruleMeta}>{formatRuleMatch(rule)}</td>
                        <td>
                          <RuleActionsCell rule={rule} options={providerOptions.data} />
                        </td>
                        <td className={styles.tableActions}>
                          <TableRowAction
                            label="Edit"
                            onActivate={(e) => {
                              e.stopPropagation();
                              openRuleEditor(rule.id);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      {section === "status" && (
        <>
          <Card title="Conversations" subtitle="Email threads linked to issues">
            {threads.length === 0 ? (
              <div className={styles.empty}>
                <EmptyIcon icon={MessagesSquare} />
                <p className={styles.emptyTitle}>No conversations yet</p>
                <p className={styles.emptyHint}>
                  Once mail starts flowing and rules match, conversations will appear here.
                </p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Sender</th>
                      <th>Subject</th>
                      <th>Messages</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {threads.map((t) => {
                      const issueLabel = `#${t.issueIid}`;
                      return (
                        <tr
                          key={t.id}
                          className={styles.tableRowClickable}
                          onClick={() => openThread(t.id, issueLabel)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openThread(t.id, issueLabel);
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`View thread ${issueLabel}`}
                        >
                          <td>
                            <a
                              href={t.issueUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {issueLabel}
                            </a>
                          </td>
                          <td>
                            {t.originalSenderName ? (
                              <>
                                {t.originalSenderName}{" "}
                                <span className={styles.ruleMeta}>
                                  &lt;{t.originalSenderEmail}&gt;
                                </span>
                              </>
                            ) : (
                              t.originalSenderEmail
                            )}
                          </td>
                          <td className={styles.tableCellTruncate}>{t.subjectNormalized}</td>
                          <td>{t.messages.length}</td>
                          <td>{new Date(t.updatedAt).toLocaleString()}</td>
                          <td className={styles.tableActions}>
                            <TableRowAction
                              label="Details"
                              onActivate={(e) => {
                                e.stopPropagation();
                                openThread(t.id, issueLabel);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <ThreadDetailDialog
              teamId={teamId}
              projectId={project.id}
              threadId={selectedThreadId}
              issueLabel={selectedThreadLabel}
              onClose={() => setSelectedThreadId(null)}
            />
          </Card>

          <Card
            title="Sync errors"
            subtitle="Recent mailbox and issue API failures for this project"
            className={styles.section}
          >
            {syncErrors.length === 0 ? (
              <p className={styles.formHint}>No active sync errors. Failures will appear here.</p>
            ) : (
              <>
                <div className={styles.syncErrorActions}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => dismissAllSyncErrors.mutate()}
                    disabled={dismissAllSyncErrors.isPending}
                  >
                    Dismiss all
                  </Button>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Operation</th>
                        <th>Message</th>
                        <th>Time</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {syncErrors.map((error) => (
                        <tr
                          key={error.id}
                          className={styles.tableRowClickable}
                          onClick={() => setSelectedSyncErrorId(error.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedSyncErrorId(error.id);
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`View sync error: ${error.operation}`}
                        >
                          <td>
                            <span className={[styles.badge, styles.badgeInactive].join(" ")}>
                              {syncErrorCategoryLabel(error.category)}
                            </span>
                          </td>
                          <td>
                            {error.operation}
                            {error.status != null ? ` · HTTP ${error.status}` : ""}
                          </td>
                          <td className={styles.tableCellTruncate}>{error.message}</td>
                          <td>{new Date(error.createdAt).toLocaleString()}</td>
                          <td className={styles.tableActions}>
                            <TableRowAction
                              label="Details"
                              onActivate={(e) => {
                                e.stopPropagation();
                                setSelectedSyncErrorId(error.id);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SyncErrorDetailDialog
                  error={selectedSyncError}
                  onClose={() => setSelectedSyncErrorId(null)}
                  onDismiss={(errorId) => dismissSyncError.mutate(errorId)}
                  isDismissing={dismissSyncError.isPending}
                />
              </>
            )}
          </Card>
        </>
      )}

      {section === "templates" && (
        <Card title="Templates">
          {templatesError && (
            <div className={[styles.alert, styles.alertError].join(" ")}>{templatesError}</div>
          )}
          <ProjectTemplatesForm
            values={templatesForm}
            onChange={updateTemplates}
            onSubmit={() => saveTemplates.mutate()}
            submitLabel={saveTemplates.isPending ? "Saving…" : "Save templates"}
            isPending={saveTemplates.isPending}
            fieldErrors={templatesFieldErrors}
            onClearFieldError={(field) =>
              setTemplatesFieldErrors((prev) => clearFieldError(prev, field))
            }
          />
        </Card>
      )}

      {section === "settings" && (
        <>
          <Card title="Project settings">
            {settingsError && (
              <div className={[styles.alert, styles.alertError].join(" ")}>{settingsError}</div>
            )}
            <ProjectSettingsForm
              key={projectId}
              mode="edit"
              teamId={teamId}
              projectId={projectId}
              values={settingsForm}
              onChange={updateSettings}
              onSubmit={() => saveSettings.mutate()}
              submitLabel={saveSettings.isPending ? "Saving…" : "Save settings"}
              isPending={saveSettings.isPending}
              fieldErrors={settingsFieldErrors}
              onClearFieldError={(field) =>
                setSettingsFieldErrors((prev) => clearFieldError(prev, field))
              }
            />
          </Card>

          <Card title="Danger zone" subtitle="Irreversible actions" className={[styles.section, styles.dangerZone].join(" ")}>
            <div className={styles.dangerZoneBody}>
              <p className={styles.dangerZoneText}>
                Permanently delete this project, including all rules, synced threads, and message
                history. This cannot be undone.
              </p>
              {deleteError && (
                <div className={[styles.alert, styles.alertError, styles.dangerZoneAlert].join(" ")}>
                  {deleteError}
                </div>
              )}
              <div className={styles.dangerZoneActions}>
                <Button variant="danger" onClick={() => setShowDeleteDialog(true)}>
                  Delete project
                </Button>
              </div>
            </div>
          </Card>

          <DestructiveConfirmDialog
            open={showDeleteDialog}
            onOpenChange={(open) => {
              setShowDeleteDialog(open);
              if (!open) setDeleteError("");
            }}
            title="Destroy this project?"
            entityName={project.name}
            description="This project and all synced data will be permanently erased. Mail will stop syncing and issue links for existing threads will be lost."
            consequences={[
              "Mailbox credentials and provider connection settings",
              "All sync rules and their match history",
              "Every email thread and message synced with issues",
              "GitLab webhooks registered for this project",
            ]}
            slideLabel="Slide all the way across to unlock project deletion"
            isPending={deleteProject.isPending}
            onConfirm={() => deleteProject.mutate()}
          />
        </>
      )}
    </Layout>
  );
}
