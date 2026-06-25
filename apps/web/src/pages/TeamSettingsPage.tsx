import { slugifyName } from "@servicebeard/shared";
import { useMutation } from "@tanstack/react-query";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DestructiveConfirmDialog } from "../components/DestructiveConfirmDialog";
import { Input } from "../components/Input";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import styles from "../styles/pages.module.css";

interface TeamDetail {
  id: string;
  name: string;
}

export function TeamSettingsPage() {
  const { user, team, role } = useLoaderData({ from: "/teams/$teamId/settings" }) as {
    user: { email: string; name: string | null };
    team: TeamDetail;
    role: string;
  };
  const navigate = useNavigate();
  const router = useRouter();

  const [teamName, setTeamName] = useState(team.name);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsIsError, setSettingsIsError] = useState(false);
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isAdmin = role === "admin" || role === "owner";
  const isOwner = role === "owner";

  const saveTeamName = useMutation({
    mutationFn: () =>
      api.updateTeam(team.id, {
        name: teamName.trim(),
        slug: slugifyName(teamName),
      }),
    onSuccess: async () => {
      await router.invalidate();
      setSettingsMessage("Team name updated.");
      setSettingsIsError(false);
      setSettingsFieldErrors({});
    },
    onError: (err) => {
      handleMutationError(err, setSettingsMessage, setSettingsFieldErrors);
      setSettingsIsError(true);
    },
  });

  const deleteTeam = useMutation({
    mutationFn: () => api.deleteTeam(team.id),
    onSuccess: async () => {
      await router.invalidate();
      navigate({ to: "/", replace: true });
    },
    onError: (err) => {
      handleMutationError(err, setDeleteError, () => {});
      setShowDeleteDialog(false);
    },
  });

  return (
    <Layout
      title="Team settings"
      description="Manage your team name and destructive actions."
      user={user}
      teamId={team.id}
      teamName={team.name}
    >
      {isAdmin ? (
        <Card title="General" subtitle="Name shown across projects and invites">
          {settingsMessage && (
            <div
              className={[
                styles.alert,
                settingsIsError ? styles.alertError : styles.alertSuccess,
                styles.dangerZoneAlert,
              ].join(" ")}
            >
              {settingsMessage}
            </div>
          )}
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !teamName.trim() ||
                teamName.trim() === team.name ||
                saveTeamName.isPending
              ) {
                return;
              }
              saveTeamName.mutate();
            }}
          >
            <Input
              label="Team name"
              value={teamName}
              error={settingsFieldErrors.name}
              onChange={(e) => {
                setTeamName(e.target.value);
                setSettingsFieldErrors((prev) => clearFieldError(prev, "name"));
                setSettingsMessage("");
              }}
            />
            <div className={styles.formActions}>
              <Button
                type="submit"
                disabled={
                  !teamName.trim() || teamName.trim() === team.name || saveTeamName.isPending
                }
              >
                {saveTeamName.isPending ? "Saving…" : "Save name"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card title="General" subtitle="Team configuration">
          <p className={styles.dangerZoneText}>
            Only team admins can change settings. Contact an admin if you need the team name
            updated.
          </p>
        </Card>
      )}

      {isOwner && (
        <Card
          title="Danger zone"
          subtitle="Irreversible actions"
          className={[styles.section, styles.dangerZone].join(" ")}
        >
          <div className={styles.dangerZoneBody}>
            <p className={styles.dangerZoneText}>
              Permanently delete this team and everything inside it — all projects, mail sync
              data, rules, conversation threads, and member access. This cannot be undone.
            </p>
            {deleteError && (
              <div className={[styles.alert, styles.alertError, styles.dangerZoneAlert].join(" ")}>
                {deleteError}
              </div>
            )}
            <div className={styles.dangerZoneActions}>
              <Button variant="danger" onClick={() => setShowDeleteDialog(true)}>
                Delete team
              </Button>
            </div>
          </div>
        </Card>
      )}

      <DestructiveConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeleteError("");
        }}
        title="Destroy this team?"
        entityName={team.name}
        description="This team and all of its data will be permanently erased from Serviceboard. Connected mailboxes will stop syncing and issue links will be lost."
        consequences={[
          "Every project and its mailbox credentials",
          "All sync rules and email thread history",
          "Pending invites and team membership",
          "Webhook registrations will become orphaned in GitLab",
        ]}
        slideLabel="Slide all the way across to unlock team deletion"
        isPending={deleteTeam.isPending}
        onConfirm={() => deleteTeam.mutate()}
      />
    </Layout>
  );
}
