import { useMutation } from "@tanstack/react-query";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Dialog } from "../components/Dialog";
import { Layout } from "../components/Layout";
import { ProjectSettingsForm } from "../components/ProjectSettingsForm";
import { RuleForm } from "../components/RuleForm";
import { ThreadDetailDialog } from "../components/ThreadDetailDialog";
import { api, type CreateRuleInput, type Rule } from "../lib/api";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import { formToUpdateInput, projectToSettingsForm, type ProjectSettingsFormValues } from "../lib/projectForm";
import styles from "../styles/pages.module.css";

type Tab = "rules" | "threads" | "settings";

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
  const { user, project, threads } = useLoaderData({
    from: "/teams/$teamId/projects/$projectId",
  });
  const { teamId } = useParams({ from: "/teams/$teamId/projects/$projectId" });
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("rules");
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [settingsForm, setSettingsForm] = useState<ProjectSettingsFormValues>(() =>
    projectToSettingsForm(project),
  );
  const [settingsError, setSettingsError] = useState("");
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<Record<string, string>>({});
  const [ruleFormError, setRuleFormError] = useState("");
  const [ruleFieldErrors, setRuleFieldErrors] = useState<Record<string, string>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadLabel, setSelectedThreadLabel] = useState("");

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
    mutationFn: () => api.updateProject(teamId, project.id, formToUpdateInput(settingsForm)),
    onSuccess: () => window.location.reload(),
    onError: (err) => handleMutationError(err, setSettingsError, setSettingsFieldErrors),
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

  const updateSettings = (
    field: keyof ProjectSettingsFormValues,
    value: string | number | boolean,
  ) => {
    setSettingsForm((f) => ({ ...f, [field]: value }));
    setSettingsFieldErrors((prev) => clearFieldError(prev, field));
    setSettingsError("");
  };

  const clearRuleFieldError = (field: string) => {
    setRuleFieldErrors((prev) => clearFieldError(prev, field));
    setRuleFormError("");
  };

  const formatRuleActions = (rule: (typeof project.rules)[number]) => {
    const parts: string[] = [];
    if (rule.actionStatus) parts.push(`status: ${rule.actionStatus}`);
    if (rule.actionLabels.length) parts.push(`labels: ${rule.actionLabels.join(", ")}`);
    if (rule.actionAssigneeId) parts.push(`assignee: ${rule.actionAssigneeId}`);
    return parts.length ? parts.join(" · ") : null;
  };

  return (
    <Layout title={project.name} user={user} teamId={teamId}>
      <div className={styles.tabs}>
        {(["rules", "threads", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            className={[styles.tab, tab === t ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                setEditingRuleId(null);
                setShowRuleForm(!showRuleForm);
              }}
            >
              {showRuleForm ? "Cancel" : "Add Rule"}
            </Button>
          </div>

          {showRuleForm && (
            <RuleForm
              key="new-rule"
              teamId={teamId}
              projectId={project.id}
              title="New Rule"
              submitLabel={createRule.isPending ? "Saving…" : "Save Rule"}
              isPending={createRule.isPending}
              formError={ruleFormError}
              fieldErrors={ruleFieldErrors}
              onClearFieldError={clearRuleFieldError}
              onCancel={() => setShowRuleForm(false)}
              onSubmit={(data) => createRule.mutate(data)}
            />
          )}

          {project.rules.length === 0 && !showRuleForm ? (
            <div className={styles.empty}>No rules configured.</div>
          ) : (
            project.rules
              .sort((a, b) => a.priority - b.priority)
              .map((rule) =>
                editingRuleId === rule.id ? (
                  <RuleForm
                    key={rule.id}
                    teamId={teamId}
                    projectId={project.id}
                    initial={ruleToFormInput(rule)}
                    title={`Edit Rule: ${rule.name}`}
                    submitLabel={updateRule.isPending ? "Saving…" : "Save Changes"}
                    isPending={updateRule.isPending}
                    formError={ruleFormError}
                    fieldErrors={ruleFieldErrors}
                    onClearFieldError={clearRuleFieldError}
                    onCancel={() => setEditingRuleId(null)}
                    onSubmit={(data) => updateRule.mutate({ ruleId: rule.id, data })}
                  />
                ) : (
                  <div key={rule.id} className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <span className={styles.ruleName}>
                        {rule.name}
                        {!rule.isEnabled && " (disabled)"}
                      </span>
                      <div className={styles.ruleActions}>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => {
                            setShowRuleForm(false);
                            setEditingRuleId(rule.id);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="small"
                          onClick={() => deleteRule.mutate(rule.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className={styles.ruleMeta}>
                      {rule.matchSender && `sender: ${rule.matchSender} `}
                      {rule.matchSubject && `subject: ${rule.matchSubject} `}
                      {rule.matchBody && `body: ${rule.matchBody}`}
                      {!rule.matchSender && !rule.matchSubject && !rule.matchBody && "match all"}
                    </div>
                    {formatRuleActions(rule) && (
                      <div className={styles.ruleMeta}>{formatRuleActions(rule)}</div>
                    )}
                  </div>
                ),
              )
          )}
        </>
      )}

      {tab === "threads" && (
        <Card title="Synced Threads">
          {threads.length === 0 ? (
            <div className={styles.empty}>No synced conversations yet.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Sender</th>
                  <th>Messages</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <a href={t.issueUrl} target="_blank" rel="noreferrer">
                        #{t.issueIid}
                      </a>
                    </td>
                    <td>
                      {t.originalSenderName ? (
                        <>
                          {t.originalSenderName}{" "}
                          <span className={styles.ruleMeta}>&lt;{t.originalSenderEmail}&gt;</span>
                        </>
                      ) : (
                        t.originalSenderEmail
                      )}
                    </td>
                    <td>{t.messages.length}</td>
                    <td>{new Date(t.updatedAt).toLocaleString()}</td>
                    <td>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setSelectedThreadId(t.id);
                          setSelectedThreadLabel(`#${t.issueIid}`);
                        }}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ThreadDetailDialog
            teamId={teamId}
            projectId={project.id}
            threadId={selectedThreadId}
            issueLabel={selectedThreadLabel}
            onClose={() => setSelectedThreadId(null)}
          />
        </Card>
      )}

      {tab === "settings" && (
        <>
          <Card title="Project Settings">
            {settingsError && (
              <div className={[styles.alert, styles.alertError].join(" ")}>{settingsError}</div>
            )}
            <ProjectSettingsForm
              mode="edit"
              values={settingsForm}
              onChange={updateSettings}
              onSubmit={() => saveSettings.mutate()}
              submitLabel={saveSettings.isPending ? "Saving…" : "Save Settings"}
              isPending={saveSettings.isPending}
              fieldErrors={settingsFieldErrors}
              webhookUrl={project.webhookUrl}
              onClearFieldError={(field) =>
                setSettingsFieldErrors((prev) => clearFieldError(prev, field))
              }
            />
          </Card>

          <Card title="Danger zone" className={styles.section}>
            <p className={styles.formHint}>
              Permanently delete this project, including all rules, synced threads, and message
              history. This cannot be undone.
            </p>
            {deleteError && (
              <div className={[styles.alert, styles.alertError].join(" ")}>{deleteError}</div>
            )}
            <Button variant="danger" onClick={() => setShowDeleteDialog(true)}>
              Delete project
            </Button>
          </Card>

          <Dialog
            open={showDeleteDialog}
            onOpenChange={(open) => {
              setShowDeleteDialog(open);
              if (!open) setDeleteError("");
            }}
            title="Delete project?"
          >
            <p className={styles.formHint}>
              Are you sure you want to delete <strong>{project.name}</strong>? All rules, synced
              threads, and message history will be permanently removed.
            </p>
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteProject.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteProject.mutate()}
                disabled={deleteProject.isPending}
              >
                {deleteProject.isPending ? "Deleting…" : "Delete project"}
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </Layout>
  );
}
