import type {
  BlockedMailPortsConfig,
  MailPortProtocol,
} from "@servicebeard/shared";
import { getBlockedMailPortWarning } from "@servicebeard/shared";
import { AlertTriangle } from "lucide-react";
import styles from "../styles/pages.module.css";

type BlockedMailPortWarningProps = {
  protocol: MailPortProtocol;
  port: number;
  config?: BlockedMailPortsConfig;
};

export function BlockedMailPortWarning({
  protocol,
  port,
  config,
}: BlockedMailPortWarningProps) {
  const warning = getBlockedMailPortWarning(protocol, port, config);
  if (!warning) return null;

  return (
    <p className={styles.portFieldWarning} role="note">
      <AlertTriangle
        size={14}
        aria-hidden
        className={styles.portFieldWarningIcon}
      />
      <span>{warning}</span>
    </p>
  );
}
