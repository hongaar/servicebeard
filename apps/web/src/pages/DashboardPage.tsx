import { slugifyName } from "@servicebeard/shared";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { EmptyIcon } from "../components/EmptyIcon";
import { Input } from "../components/Input";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { iconMd } from "../lib/icons";
import type { AppUser, TeamSummary } from "../lib/loaderTypes";
import styles from "../styles/pages.module.css";

type DashboardPageProps = {
  user: AppUser;
  teams: TeamSummary[];
};

export function DashboardPage({ user, teams }: DashboardPageProps) {
  const ownedTeamCount = teams.filter((team) => team.role === "owner").length;
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const router = useRouter();

  const createTeam = useMutation({
    mutationFn: () =>
      api.createTeam({
        name,
        slug: slugifyName(name),
      }),
    onSuccess: async (team) => {
      await router.invalidate();
      setShowCreate(false);
      setName("");
      if (ownedTeamCount >= 1) {
        navigate({ to: "/teams/$teamId/billing", params: { teamId: team.id } });
        return;
      }
      navigate({ to: "/teams/$teamId/projects", params: { teamId: team.id } });
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
              Each team has its own members and mail-sync projects. Your account includes one free
              team; additional teams you create need their own subscription.
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "Create team"}
          </Button>
        </div>

        {showCreate && (
          <Dialog open={showCreate} onOpenChange={setShowCreate} title="Create a team">
            <p className={styles.formHint} style={{ marginTop: 0, marginBottom: "1rem" }}>
              Teams group people and projects together.
              {ownedTeamCount >= 1 && (
                <>
                  {" "}
                  Because you already own a team, this new team will require its own subscription
                  before you can use it.
                </>
              )}
            </p>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim() || createTeam.isPending) return;
                createTeam.mutate();
              }}
            >
              <Input
                label="Team name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div className={styles.formActions}>
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!name.trim() || createTeam.isPending}
                >
                  {createTeam.isPending ? "Creating…" : "Create team"}
                </Button>
              </div>
            </form>
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
            {teams.map((team) => {
              const needsSubscription = Boolean(team.subscriptionRequired);
              const teamLink =
                needsSubscription && team.role === "owner"
                  ? {
                      to: "/teams/$teamId/billing" as const,
                      params: { teamId: team.id },
                    }
                  : {
                      to: "/teams/$teamId/projects" as const,
                      params: { teamId: team.id },
                    };

              return (
                <Link key={team.id} {...teamLink} className={styles.teamCard}>
                  <div className={styles.teamCardTop}>
                    <span className={styles.teamAvatar} aria-hidden>
                      {team.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className={styles.teamArrow} aria-hidden>
                      <ChevronRight {...iconMd} />
                    </span>
                  </div>
                  <div className={styles.teamName}>{team.name}</div>
                  <div className={styles.teamRole}>
                    {team.role}
                    {needsSubscription && (
                      <span className={[styles.badge, styles.badgeInactive].join(" ")}>
                        Subscription required
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
