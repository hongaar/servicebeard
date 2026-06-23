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
  const { user, projects } = useLoaderData({ from: "/teams/$teamId/projects" });
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
    <Layout title="Projects" user={user} teamId={teamId}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <Button variant="secondary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "New Project"}
        </Button>
      </div>

      {error && <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>}

      {showCreate && (
        <Card title="Create Project" className={styles.section}>
          <ProjectSettingsForm
            mode="create"
            values={form}
            onChange={update}
            onSubmit={() => create.mutate()}
            onCancel={() => setShowCreate(false)}
            submitLabel={create.isPending ? "Creating…" : "Create Project"}
            isPending={create.isPending}
            fieldErrors={fieldErrors}
            onClearFieldError={(field) =>
              setFieldErrors((prev) => clearFieldError(prev, field))
            }
          />
        </Card>
      )}

      {projects.length === 0 ? (
        <div className={styles.empty}>No projects yet.</div>
      ) : (
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
                <td>{p.name}</td>
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
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
