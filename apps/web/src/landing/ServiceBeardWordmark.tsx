import styles from "./LandingPage.module.css";

type ServiceBeardWordmarkProps = {
  as?: "h1" | "p" | "span" | "strong";
  size?: "default" | "sm" | "brand";
  className?: string;
};

export function ServiceBeardWordmark({
  as: Tag = "span",
  size = "default",
  className,
}: ServiceBeardWordmarkProps) {
  const titleClass = [
    styles.wordmark,
    size === "sm" ? styles.wordmarkSm : "",
    size === "brand" ? styles.wordmarkBrand : "",
    size === "default" && Tag === "h1" ? styles.wordmarkHero : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={titleClass}>
      Service<span className={styles.wordmarkAccent}>Beard</span>
    </Tag>
  );
}
