import { Button } from "./Button";
import styles from "./OnboardingPopover.module.css";

interface OnboardingPopoverProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onDismiss: () => void;
}

export function OnboardingPopover({
  open,
  title,
  children,
  onDismiss,
}: OnboardingPopoverProps) {
  if (!open) return null;

  return (
    <div
      className={styles.popover}
      role="dialog"
      aria-labelledby="onboarding-popover-title"
      aria-live="polite"
    >
      <h3 id="onboarding-popover-title" className={styles.title}>
        {title}
      </h3>
      <p className={styles.body}>{children}</p>
      <div className={styles.actions}>
        <Button type="button" onClick={onDismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}

export function OnboardingAnchor({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.anchor, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
