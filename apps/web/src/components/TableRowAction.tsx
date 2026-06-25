import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { iconSm } from "../lib/icons";
import styles from "../styles/pages.module.css";

type TableRowActionProps = {
  label: string;
  onActivate: (e: React.MouseEvent) => void;
};

type TableRowActionLinkProps = TableRowActionProps & {
  link: LinkProps;
};

function TableRowActionInner({ label }: { label: string }) {
  return (
    <span className={styles.tableRowLinkInner}>
      {label}
      <ArrowRight {...iconSm} />
    </span>
  );
}

export function TableRowAction({ label, onActivate }: TableRowActionProps) {
  return (
    <button type="button" className={styles.tableRowLink} onClick={onActivate}>
      <TableRowActionInner label={label} />
    </button>
  );
}

export function TableRowActionLink({ label, onActivate, link }: TableRowActionLinkProps) {
  return (
    <Link {...link} className={styles.tableRowLink} onClick={onActivate}>
      <TableRowActionInner label={label} />
    </Link>
  );
}
