import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../lib/api";
import styles from "../styles/pages.module.css";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = search.token ?? "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.resetPassword(token, password);
      setMessage(result.message);
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Choose a new password</h1>

        {error && <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>}
        {message && <div className={[styles.alert, styles.alertSuccess].join(" ")}>{message}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" disabled={loading || !token} className={styles.fullWidth}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>

        <p className={styles.formHint}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
