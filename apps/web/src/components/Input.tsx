import { HelpTip } from "./HelpTip";
import styles from "./Input.module.css";

interface FieldProps {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  labelAction?: React.ReactNode;
  children: React.ReactNode;
}

export function Field({
  label,
  error,
  hint,
  labelAction,
  children,
}: FieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label}>
          <span>{label}</span>
          {hint && <HelpTip label={`Help: ${label}`}>{hint}</HelpTip>}
        </label>
        {labelAction}
      </div>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: React.ReactNode;
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input
        className={[styles.input, className].filter(Boolean).join(" ")}
        {...props}
      />
    </Field>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  labelAction?: React.ReactNode;
}

export function Textarea({
  label,
  error,
  hint,
  labelAction,
  className,
  ...props
}: TextareaProps) {
  return (
    <Field label={label} error={error} hint={hint} labelAction={labelAction}>
      <textarea
        className={[styles.textarea, className].filter(Boolean).join(" ")}
        {...props}
      />
    </Field>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  options: Array<{ value: string; label: string }>;
}

export function Select({
  label,
  error,
  hint,
  options,
  className,
  ...props
}: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      <select
        className={[styles.select, className].filter(Boolean).join(" ")}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.checkboxLabel}>
        {label}
        {hint && <HelpTip label={`Help: ${label}`}>{hint}</HelpTip>}
      </span>
    </label>
  );
}
