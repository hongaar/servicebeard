import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { api } from "../lib/api";
import styles from "../styles/pages.module.css";

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { token } = useParams({ strict: false }) as { token: string };
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .getMe()
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    try {
      await api.acceptInvite(token);
      setSuccess(true);
      setTimeout(() => navigate({ to: "/" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.formHint}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Team invite</h1>
          <p className={styles.subtitle}>
            Sign in or create an account to accept this invite.
          </p>
          <Button
            className={styles.fullWidth}
            onClick={() =>
              navigate({
                to: "/login",
                search: { redirect: `/invites/${token}` },
              })
            }
          >
            Continue to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Team invite</h1>
        {success ? (
          <div className={[styles.alert, styles.alertSuccess].join(" ")}>
            Invite accepted. Redirecting…
          </div>
        ) : (
          <>
            <p className={styles.subtitle}>
              Accept the invite as <strong>{user.email}</strong>?
            </p>
            {error && (
              <div className={[styles.alert, styles.alertError].join(" ")}>
                {error}
              </div>
            )}
            <div className={styles.form}>
              <Button
                className={styles.fullWidth}
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? "Accepting…" : "Accept invite"}
              </Button>
              <p className={styles.formHint}>
                Signed in as the wrong account?{" "}
                <Link to="/account">Switch account</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
