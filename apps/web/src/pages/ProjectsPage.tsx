import { useMutation } from "@tanstack/react-query";
import { Link, useLoaderData, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { ProjectSettingsForm } from "../components/ProjectSettingsForm";
import { api } from "../lib/api";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import {
    defaultProjectSettingsForm,
    formToCreateInput,
    type ProjectSettingsFormValues,
} from "../lib/projectForm";
import styles from "../styles/pages.module.css";

export function ProjectsPage() {
  const { user, projects, teamName } = useLoaderData({ from: "/teams/$teamId/projects" });
  const { teamId } = useParams({ from: "/teams/$teamId/projects" });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ProjectSettingsFormValues>({
    ...defaultProjectSettingsForm,
    imapPassword: "support",
    smtpPassword: "support",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => api.createProject(teamId, formToCreateInput(form)),
    onSuccess: () => {
      window.location.reload();
    },
    onError: (err) => handleMutationError(err, setError, setFieldErrors),
  });

  const update = (field: keyof ProjectSettingsFormValues, value: string | number | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => clearFieldError(prev, field));
    setError("");
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
            {projects.length === 0
              ? "Create a project to start syncing email threads."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} configured`}
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "New project"}
        </Button>
      </div>

      {error && <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>}

      {showCreate && (
        <Card title="New project" subtitle="Connect your mailbox and issue provider" className={styles.section}>
          <ProjectSettingsForm
            mode="create"
            values={form}
            onChange={update}
            onSubmit={() => create.mutate()}
            onCancel={() => setShowCreate(false)}
            submitLabel={create.isPending ? "Creating…" : "Create project"}
            isPending={create.isPending}
            fieldErrors={fieldErrors}
            onClearFieldError={(field) =>
              setFieldErrors((prev) => clearFieldError(prev, field))
            }
          />
        </Card>
      )}

      {projects.length === 0 && !showCreate ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden>P</span>
          <p className={styles.emptyTitle}>No projects yet</p>
          <p className={styles.emptyHint}>
            A project links your support inbox to GitLab (or another provider) so incoming mail
            becomes tracked issues automatically.
          </p>
          <Button onClick={() => setShowCreate(true)}>Create your first project</Button>
        </div>
      ) : projects.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>{p.provider}</td>
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
                  <td>
                    <Link
                      to="/teams/$teamId/projects/$projectId"
                      params={{ teamId, projectId: p.id }}
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Layout>
  );
}
