import { parseMailFromAddress } from "@servicebeard/shared/mail";
import { useMutation } from "@tanstack/react-query";
import { Link, useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowRight, FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyIcon } from "../components/EmptyIcon";
import { Layout } from "../components/Layout";
import { ProjectSettingsForm } from "../components/ProjectSettingsForm";
import { ProviderLogo } from "../components/ProviderLogo";
import { api } from "../lib/api";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import { iconSm } from "../lib/icons";
import {
    defaultProjectSettingsForm,
    formToCreateInput,
    type ProjectSettingsFormValues,
} from "../lib/projectForm";
import styles from "../styles/pages.module.css";

export function ProjectsPage() {
  const { user, projects, teamName } = useLoaderData({ from: "/teams/$teamId/projects" });
  const { teamId } = useParams({ from: "/teams/$teamId/projects" });
  const navigate = useNavigate();

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
          <EmptyIcon icon={FolderPlus} />
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
                <th>Inbox</th>
                <th>Provider</th>
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
                    <ProviderLogo provider={p.provider} />
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
                    <Link
                      to="/teams/$teamId/projects/$projectId/$section"
                      params={{ teamId, projectId: p.id, section: "rules" }}
                      className={styles.tableRowLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={styles.tableRowLinkInner}>
                        Open
                        <ArrowRight {...iconSm} />
                      </span>
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
