import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import styles from "./DocsLink.module.css";

interface DocsLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  role?: string;
  iconSize?: number;
}

export function DocsLink({
  to,
  children,
  className,
  onClick,
  role,
  iconSize = 12,
}: DocsLinkProps) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noopener noreferrer"
      className={[styles.link, className].filter(Boolean).join(" ")}
      onClick={onClick}
      role={role}
    >
      {children}
      <ExternalLink size={iconSize} className={styles.icon} aria-hidden />
    </Link>
  );
}
