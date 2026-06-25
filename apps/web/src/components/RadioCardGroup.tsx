import styles from "./RadioCardGroup.module.css";

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: string;
  icon?: React.ReactNode;
}

interface RadioCardGroupProps {
  name: string;
  label: string;
  value: string;
  options: RadioCardOption[];
  onChange: (value: string) => void;
  hint?: React.ReactNode;
}

export function RadioCardGroup({
  name,
  label,
  value,
  options,
  onChange,
  hint,
}: RadioCardGroupProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>
        {label}
        {hint && <span className={styles.legendHint}>{hint}</span>}
      </legend>
      <div className={styles.grid} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={[
                styles.card,
                selected ? styles.cardSelected : "",
                option.disabled ? styles.cardDisabled : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className={styles.input}
              />
              <span className={styles.cardBody}>
                <span className={styles.cardTop}>
                  {option.icon && <span className={styles.icon}>{option.icon}</span>}
                  <span className={styles.cardLabel}>{option.label}</span>
                  {option.badge && <span className={styles.badge}>{option.badge}</span>}
                </span>
                {option.description && (
                  <span className={styles.cardDescription}>{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
