import { useState } from "react";
import { Link, useLoaderData } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { Input } from "../components/Input";
import { api } from "../lib/api";
import styles from "../styles/pages.module.css";

export function DashboardPage() {
  const { user, teams } = useLoaderData({ from: "/" });
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
    <Layout title="Dashboard" user={user}>
      <div className={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 className={styles.sectionTitle}>Your Teams</h2>
          <Button variant="secondary" size="small" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "Create Team"}
          </Button>
        </div>

        {showCreate && (
          <Dialog open={showCreate} onOpenChange={setShowCreate} title="New Team">
            <div className={styles.form}>
              <Input
                label="Team Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }}
              />
              <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <div className={styles.formActions}>
                <Button
                  onClick={() => createTeam.mutate()}
                  disabled={!name || !slug || createTeam.isPending}
                >
                  Create
                </Button>
              </div>
            </div>
          </Dialog>
        )}

        {teams.length === 0 ? (
          <div className={styles.empty}>No teams yet. Create one to get started.</div>
        ) : (
          <div className={styles.grid}>
            {teams.map((team) => (
              <Link
                key={team.id}
                to="/teams/$teamId"
                params={{ teamId: team.id }}
                className={styles.teamCard}
              >
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
