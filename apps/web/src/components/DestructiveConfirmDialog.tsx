import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import dialogStyles from "./DestructiveConfirmDialog.module.css";
import { Dialog } from "./Dialog";
import { SlideToConfirm } from "./SlideToConfirm";

interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityName: string;
  description: string;
  consequences: string[];
  slideLabel?: string;
  slideUnlockedLabel?: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
}

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  entityName,
  description,
  consequences,
  slideLabel = "Slide all the way across to unlock deletion",
  slideUnlockedLabel = "Unlocked — you may delete now",
  confirmLabel = "Permanently delete",
  isPending,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setUnlocked(false);
      setResetKey((k) => k + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} wide>
      <div className={dialogStyles.banner}>
        <AlertTriangle size={20} aria-hidden />
        <span>
          You are about to permanently destroy <strong>{entityName}</strong>.
        </span>
      </div>

      <p className={styles.formHint} style={{ marginTop: "1rem" }}>
        {description}
      </p>

      <ul className={dialogStyles.consequences}>
        {consequences.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className={dialogStyles.slideWrap}>
        <SlideToConfirm
          label={slideLabel}
          unlockedLabel={slideUnlockedLabel}
          isPending={isPending}
          resetKey={resetKey}
          onUnlock={() => setUnlocked(true)}
        />
      </div>

      <div className={[styles.formActions, dialogStyles.actions].join(" ")}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          className={unlocked ? dialogStyles.deleteReady : undefined}
          onClick={onConfirm}
          disabled={!unlocked || isPending}
        >
          {isPending ? "Deleting…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
