import { useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "../components/Card";
import { GITHUB_APP_INSTALL_MESSAGE } from "../lib/githubAppInstall";
import styles from "../styles/pages.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  disabled: "GitHub App integration is not enabled on this server.",
  not_configured: "GitHub App is missing server credentials.",
  install_failed: "Could not start GitHub App installation.",
  invalid_callback: "GitHub App installation callback was invalid.",
  state_mismatch: "GitHub App installation state did not match.",
};

export function GithubAppInstallCompletePage() {
  const search = useSearch({ strict: false }) as {
    githubInstallationId?: string;
    githubAppError?: string;
  };
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const payload = {
      type: GITHUB_APP_INSTALL_MESSAGE,
      installationId: search.githubInstallationId,
      error: search.githubAppError,
    };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }

    setStandalone(true);
  }, [search.githubAppError, search.githubInstallationId]);

  const errorMessage = search.githubAppError
    ? (ERROR_MESSAGES[search.githubAppError] ?? "GitHub App installation failed.")
    : null;

  return (
    <div className={styles.authPage}>
      <Card title="GitHub App">
        {errorMessage ? (
          <p className={[styles.alert, styles.alertError].join(" ")}>{errorMessage}</p>
        ) : search.githubInstallationId ? (
          <p className={styles.formHint}>
            GitHub App connected. Return to ServiceBeard to continue — this window should close
            automatically.
          </p>
        ) : (
          <p className={styles.formHint}>Finishing GitHub App setup…</p>
        )}
        {standalone && search.githubInstallationId && (
          <p className={styles.formHint}>
            Installation ID: <code>{search.githubInstallationId}</code>
          </p>
        )}
        {standalone && errorMessage && (
          <p className={styles.formHint}>
            You can close this tab and try again from the project wizard.
          </p>
        )}
      </Card>
    </div>
  );
}
