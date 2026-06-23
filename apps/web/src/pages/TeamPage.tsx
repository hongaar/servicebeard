import { useMutation } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
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
  const { user, team } = useLoaderData({ from: "/teams/$teamId" }) as {
    user: { email: string; name: string | null };
    team: TeamDetail;
  };
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const invite = useMutation({
    mutationFn: () => api.inviteMember(team.id, { email, role }),
    onSuccess: () => {
      setMessage(`Invite sent to ${email}`);
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
    onSuccess: () => window.location.reload(),
  });

  return (
    <Layout title={team.name} user={user} teamId={team.id}>
      {message && (
        <div
          className={[styles.alert, isError ? styles.alertError : styles.alertSuccess].join(" ")}
        >
          {message}
        </div>
      )}

      <Card title="Members" subtitle={`${team.members.length} member(s)`}>
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
                  {m.role !== "owner" && (
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
      </Card>

      <Card title="Invite Member" className={styles.section}>
        <div className={styles.form}>
          <div className={styles.row}>
            <Input
              label="Email"
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
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={[
                { value: "member", label: "Member" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </div>
          <div className={styles.formActions}>
            <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending}>
              Send Invite
            </Button>
          </div>
        </div>
      </Card>
    </Layout>
  );
}
