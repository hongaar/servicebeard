import { ShieldAlert } from "lucide-react";
import { iconMd } from "../lib/icons";
import styles from "../styles/pages.module.css";

export function PlatformAdminAccessBanner() {
  return (
    <div
      className={[styles.alert, styles.alertWarning].join(" ")}
      role="status"
    >
      <div className={styles.platformAdminBanner}>
        <ShieldAlert {...iconMd} aria-hidden />
        <div>
          <p className={styles.platformAdminBannerTitle}>
            Platform admin access
          </p>
          <p className={styles.platformAdminBannerText}>
            You are not a member of this team, but you can view and edit it
            because you are a platform administrator. Changes here affect real
            customer data — proceed with caution.
          </p>
        </div>
      </div>
    </div>
  );
}
