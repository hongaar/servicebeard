import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../lib/api";
import styles from "../styles/pages.module.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await api.forgotPassword(email);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.subtitle}>
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>

        {error && <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>}
        {message && <div className={[styles.alert, styles.alertSuccess].join(" ")}>{message}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Button type="submit" disabled={loading} className={styles.fullWidth}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className={styles.formHint}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
