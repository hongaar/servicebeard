import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import styles from "./Dialog.module.css";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, title, wide, children }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.dialogBackdrop} />
        <BaseDialog.Popup
          className={[styles.dialogPopup, wide ? styles.dialogPopupWide : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <BaseDialog.Close className={styles.dialogClose} aria-label="Close">
            ×
          </BaseDialog.Close>
          <BaseDialog.Title className={styles.dialogTitle}>{title}</BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
