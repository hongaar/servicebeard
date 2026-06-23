import { Tooltip } from "@base-ui/react/tooltip";
import styles from "./HelpTip.module.css";

interface HelpTipProps {
  children: React.ReactNode;
  label?: string;
}

export function HelpTip({ children, label = "More information" }: HelpTipProps) {
  return (
    <Tooltip.Provider delay={100}>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          className={styles.trigger}
          aria-label={label}
          onClick={(e) => e.preventDefault()}
        >
          ?
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6} className={styles.positioner}>
            <Tooltip.Popup className={styles.popup}>{children}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
