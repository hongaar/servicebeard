import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { captureBugsinkError, isBugsinkEnabled } from "../lib/bugsink";
import { iconLg } from "../lib/icons";
import { describeRouteError, shouldReportRouteError } from "../lib/routeError";
import styles from "../styles/error.module.css";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const details = describeRouteError(error);
  const [showDetails, setShowDetails] = useState(import.meta.env.DEV);

  useEffect(() => {
    if (!shouldReportRouteError(error)) return;
    captureBugsinkError(error, {
      status: details.status,
      path: window.location.pathname,
    });
  }, [error, details.status]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.brand}>
          <img
            src="/favicon.png"
            alt=""
            className={styles.brandLogo}
            width={24}
            height={24}
          />
          Service<span className={styles.brandAccent}>Beard</span>
        </Link>

        <div className={styles.icon} aria-hidden>
          <AlertTriangle {...iconLg} />
        </div>

        {details.status !== undefined && (
          <p className={styles.status}>HTTP {details.status}</p>
        )}

        <h1 className={styles.title}>{details.title}</h1>
        <p className={styles.hint}>{details.hint}</p>

        <div className={styles.actions}>
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <ButtonLink to="/" variant="secondary">
            Go to dashboard
          </ButtonLink>
        </div>

        <button
          type="button"
          className={styles.detailsToggle}
          onClick={() => setShowDetails((open) => !open)}
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide technical details" : "Show technical details"}
        </button>

        {showDetails && (
          <div className={styles.details}>
            <span className={styles.detailsLabel}>Error message</span>
            <pre className={styles.detailsMessage}>{details.technical}</pre>
          </div>
        )}

        {isBugsinkEnabled() && shouldReportRouteError(error) && (
          <p className={styles.trackingNote}>
            This error was reported automatically so we can investigate.
          </p>
        )}
      </div>
    </div>
  );
}
