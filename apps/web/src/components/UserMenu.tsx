import { CircleHelp, LogOut } from "lucide-react";
import { api } from "../lib/api";
import { DOC_PATHS } from "../lib/docs";
import { iconSm } from "../lib/icons";
import { Button } from "./Button";
import btn from "./Button.module.css";
import { DocsLink } from "./DocsLink";
import popoverStyles from "./Popover.module.css";
import { PopoverChevron, usePopover } from "./usePopover.tsx";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  user: { email: string; name: string | null };
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: UserMenuProps) {
  const { open, toggle, close, rootRef } = usePopover();

  const handleLogout = async () => {
    close();
    await api.logout();
    window.location.href = "/login";
  };

  const displayName = user.name ?? user.email.split("@")[0];

  return (
    <div className={popoverStyles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={styles.avatar} aria-hidden>
          {getInitials(user.name, user.email)}
        </span>
        <span className={styles.triggerMeta}>
          <span className={styles.triggerName}>{displayName}</span>
          <span className={styles.triggerEmail}>{user.email}</span>
        </span>
        <PopoverChevron open={open} className={popoverStyles.chevron} />
      </button>

      {open && (
        <div
          className={[popoverStyles.menu, popoverStyles.menuRight, styles.menu].join(" ")}
          role="menu"
        >
          <div className={styles.menuHeader}>
            <span className={styles.menuAvatar} aria-hidden>
              {getInitials(user.name, user.email)}
            </span>
            <div>
              <p className={styles.menuName}>{displayName}</p>
              <p className={styles.menuEmail}>{user.email}</p>
            </div>
          </div>
          <div className={styles.menuActions}>
            <DocsLink
              to={DOC_PATHS.index}
              className={[btn.button, btn.ghost, btn.small, styles.menuAction].join(" ")}
              role="menuitem"
              iconSize={14}
              onClick={close}
            >
              <CircleHelp {...iconSm} />
              Help
            </DocsLink>
            <Button variant="ghost" size="small" onClick={handleLogout} className={styles.menuAction}>
              <LogOut {...iconSm} />
              Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
