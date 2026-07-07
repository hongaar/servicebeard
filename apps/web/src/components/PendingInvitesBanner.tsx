import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { iconSm } from "../lib/icons";
import { refreshAppRoutes } from "../lib/queryClient";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";

export type PendingTeamInvite = {
  id: string;
  teamId: string;
  teamName: string;
  role: string;
  expiresAt: string;
};

export function PendingInvitesBanner({
  invites: initialInvites,
}: {
  invites: PendingTeamInvite[];
}) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const acceptInvite = useMutation({
    mutationFn: (inviteId: string) => api.acceptPendingInvite(inviteId),
    onSuccess: async (_member, inviteId) => {
      setInvites((current) =>
        current.filter((invite) => invite.id !== inviteId),
      );
      setAcceptingId(null);
      setError("");
      await refreshAppRoutes(router, { pendingInvites: true });
    },
    onError: (err) => {
      setAcceptingId(null);
      setError(err instanceof Error ? err.message : "Could not accept invite");
    },
  });

  if (invites.length === 0) return null;

  return (
    <div className={styles.inviteBanner}>
      <div className={styles.inviteBannerHeader}>
        <Mail {...iconSm} aria-hidden />
        <span>
          {invites.length === 1
            ? "You have a pending team invite"
            : `You have ${invites.length} pending team invites`}
        </span>
      </div>
      {error && (
        <div className={[styles.alert, styles.alertError].join(" ")}>
          {error}
        </div>
      )}
      <ul className={styles.inviteBannerList}>
        {invites.map((invite) => (
          <li key={invite.id} className={styles.inviteBannerItem}>
            <div className={styles.inviteBannerDetails}>
              <strong>{invite.teamName}</strong>
              <span className={styles.inviteBannerRole}>as {invite.role}</span>
            </div>
            <Button
              size="small"
              disabled={acceptingId !== null}
              onClick={() => {
                setError("");
                setAcceptingId(invite.id);
                acceptInvite.mutate(invite.id);
              }}
            >
              {acceptingId === invite.id ? "Joining…" : "Accept invite"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
