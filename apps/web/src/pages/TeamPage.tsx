import { useMutation } from "@tanstack/react-query";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input, Select } from "../components/Input";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { clearFieldError, handleMutationError } from "../lib/formErrors";
import styles from "../styles/pages.module.css";

interface TeamMemberRow {
  id: string;
  role: string;
  user: { name: string | null; email: string };
}

interface TeamDetail {
  id: string;
  name: string;
  members: TeamMemberRow[];
}

export function TeamPage() {
  const { user, team, role } = useLoaderData({ from: "/teams/$teamId/members" }) as {
    user: { email: string; name: string | null };
    team: TeamDetail;
    role: string;
  };
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isAdmin = role === "admin" || role === "owner";

  const invite = useMutation({
    mutationFn: () => api.inviteMember(team.id, { email, role: inviteRole }),
    onSuccess: async (result) => {
      const target = email.trim();
      await router.invalidate();
      if ("added" in result && result.added) {
        if (result.emailSent) {
          setMessage(`${target} was added to the team. A notification was sent to their inbox.`);
        } else {
          setMessage(`${target} was added to the team. System mail is not configured, so no email was sent.`);
        }
      } else if (result.emailSent) {
        setMessage(`Invite sent to ${target}`);
      } else {
        setMessage(`Invite created for ${target}. System mail is not configured — share the invite link manually.`);
      }
      setIsError(false);
      setFieldErrors({});
      setEmail("");
    },
    onError: (err) => {
      handleMutationError(err, setMessage, setFieldErrors);
      setIsError(true);
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.removeMember(team.id, memberId),
    onSuccess: async () => {
      await router.invalidate();
      setMessage("Member removed.");
      setIsError(false);
    },
  });

  return (
    <Layout
      title="Members"
      description="Manage who has access to this team and its projects."
      user={user}
      teamId={team.id}
      teamName={team.name}
    >
      {message && (
        <div
          className={[styles.alert, isError ? styles.alertError : styles.alertSuccess].join(" ")}
        >
          {message}
        </div>
      )}

      <Card title="Members" subtitle={`${team.members.length} people on this team`}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.name ?? "—"}</td>
                  <td>{m.user.email}</td>
                  <td style={{ textTransform: "capitalize" }}>{m.role}</td>
                  <td>
                    {isAdmin && m.role !== "owner" && (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => removeMember.mutate(m.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isAdmin && (
        <Card title="Invite someone" subtitle="They'll receive an email to join this team" className={styles.section}>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (!email || invite.isPending) return;
              invite.mutate();
            }}
          >
            <div className={styles.row}>
              <Input
                label="Email address"
                type="email"
                value={email}
                error={fieldErrors.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((prev) => clearFieldError(prev, "email"));
                  setMessage("");
                }}
              />
              <Select
                label="Role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                options={[
                  { value: "member", label: "Member — can view and manage projects" },
                  { value: "admin", label: "Admin — can invite and remove members" },
                ]}
              />
            </div>
            <div className={styles.formActions}>
              <Button type="submit" disabled={!email || invite.isPending}>
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </Layout>
  );
}
