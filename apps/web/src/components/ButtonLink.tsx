import { Link, type LinkComponentProps } from "@tanstack/react-router";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

function buttonClassName(
  variant: ButtonVariant,
  size: "default" | "small",
  className?: string,
) {
  return [
    styles.button,
    styles[variant],
    size === "small" ? styles.small : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonLinkProps = LinkComponentProps<"a"> & {
  variant?: ButtonVariant;
  size?: "default" | "small";
};

export function ButtonLink({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

type ExternalButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: "default" | "small";
};

export function ExternalButtonLink({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: ExternalButtonLinkProps) {
  return (
    <a className={buttonClassName(variant, size, className)} {...props}>
      {children}
    </a>
  );
}

export { buttonClassName };
