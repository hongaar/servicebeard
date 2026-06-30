import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import styles from "../styles/pages.module.css";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = search.token ?? "";

  useEffect(() => {
    if (!token) {
      setError("Missing verification token. Use the link from your email.");
      setLoading(false);
      return;
    }

    api
      .verifyEmail(token)
      .then((result) => {
        setMessage(result.message);
        setTimeout(() => navigate({ to: "/login" }), 2000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Verification failed");
      })
      .finally(() => setLoading(false));
  }, [navigate, token]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Confirm your email</h1>

        {loading && <p className={styles.formHint}>Verifying your email…</p>}
        {error && (
          <div className={[styles.alert, styles.alertError].join(" ")}>
            {error}
          </div>
        )}
        {message && (
          <div className={[styles.alert, styles.alertSuccess].join(" ")}>
            {message}
          </div>
        )}

        {!loading && error && (
          <p className={styles.formHint}>
            <Link to="/login">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
