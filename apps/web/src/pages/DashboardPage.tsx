import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { EmptyIcon } from "../components/EmptyIcon";
import { Input } from "../components/Input";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { iconMd } from "../lib/icons";
import styles from "../styles/pages.module.css";

export function DashboardPage() {
  const data = useLoaderData({ from: "/" });
  if (!data.user) return null;

  const { user, teams } = data;
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const queryClient = useQueryClient();

  const createTeam = useMutation({
    mutationFn: () => api.createTeam({ name, slug }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowCreate(false);
      setName("");
      setSlug("");
    },
  });

  return (
    <Layout
      title="Dashboard"
      description="Your teams and projects live here. Open a team to invite members and connect mailboxes."
      user={user}
    >
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderText}>
            <h2 className={styles.sectionTitle}>Your teams</h2>
            <p className={styles.sectionDescription}>
              Each team has its own members and mail-sync projects.
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "Create team"}
          </Button>
        </div>

        {showCreate && (
          <Dialog open={showCreate} onOpenChange={setShowCreate} title="Create a team">
            <p className={styles.formHint} style={{ marginTop: 0, marginBottom: "1rem" }}>
              Teams group people and projects together. Pick a short, URL-friendly slug.
            </p>
            <div className={styles.form}>
              <Input
                label="Team name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, ""),
                  );
                }}
              />
              <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <div className={styles.formActions}>
                <Button
                  variant="secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createTeam.mutate()}
                  disabled={!name || !slug || createTeam.isPending}
                >
                  {createTeam.isPending ? "Creating…" : "Create team"}
                </Button>
              </div>
            </div>
          </Dialog>
        )}

        {teams.length === 0 ? (
          <div className={styles.empty}>
            <EmptyIcon icon={Users} />
            <p className={styles.emptyTitle}>No teams yet</p>
            <p className={styles.emptyHint}>
              Create your first team to start syncing support mail with your issue board.
            </p>
            <Button onClick={() => setShowCreate(true)}>Create your first team</Button>
          </div>
        ) : (
          <div className={styles.grid}>
            {teams.map((team) => (
              <Link
                key={team.id}
                to="/teams/$teamId/projects"
                params={{ teamId: team.id }}
                className={styles.teamCard}
              >
                <div className={styles.teamCardTop}>
                  <span className={styles.teamAvatar} aria-hidden>
                    {team.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className={styles.teamArrow} aria-hidden>
                    <ChevronRight {...iconMd} />
                  </span>
                </div>
                <div className={styles.teamName}>{team.name}</div>
                <div className={styles.teamRole}>{team.role}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
