import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { captureBugsinkError, isBugsinkEnabled } from "../lib/bugsink";
import { documentTitle } from "../lib/documentTitle";
import { iconMd } from "../lib/icons";
import { describeRouteError, shouldReportRouteError } from "../lib/routeError";
import styles from "../styles/error.module.css";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const details = describeRouteError(error);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!shouldReportRouteError(error)) return;
    captureBugsinkError(error, {
      status: details.status,
      path: window.location.pathname,
    });
  }, [error, details.status]);

  useEffect(() => {
    document.title = documentTitle(details.title);
  }, [details.title]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <Link to="/" className={styles.brand}>
            <img
              src="/favicon.png"
              alt=""
              className={styles.brandLogo}
              width={36}
              height={36}
            />
            <span className={styles.brandName}>
              Service<span className={styles.brandAccent}>Beard</span>
            </span>
          </Link>
        </div>

        <div className={styles.heading}>
          <div className={styles.icon} aria-hidden>
            <AlertTriangle {...iconMd} />
          </div>
          <h1 className={styles.title}>{details.title}</h1>
          {details.status !== undefined && (
            <span className={styles.status}>HTTP {details.status}</span>
          )}
        </div>

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
