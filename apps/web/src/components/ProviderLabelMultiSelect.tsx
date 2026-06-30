import { providerLabelTagVars } from "../lib/providerLabel";
import { Field } from "./Input";
import inputStyles from "./Input.module.css";
import popoverStyles from "./Popover.module.css";
import styles from "./ProviderLabelMultiSelect.module.css";
import { PopoverChevron, usePopover } from "./usePopover";

export interface ProviderLabelOption {
  name: string;
  color: string | null;
}

interface ProviderLabelMultiSelectProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: ProviderLabelOption[];
  disabled?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  placeholder?: string;
}

export function ProviderLabelMultiSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  loading,
  loadingMessage = "Loading labels…",
  emptyMessage = "No labels found in the project.",
  placeholder = "No labels selected",
}: ProviderLabelMultiSelectProps) {
  const { open, toggle, rootRef } = usePopover();
  const optionByName = new Map(options.map((option) => [option.name, option]));
  const selected = value.map(
    (name) => optionByName.get(name) ?? { name, color: null },
  );

  const isDisabled = disabled || loading || options.length === 0;
  const triggerLabel = loading
    ? loadingMessage
    : options.length === 0
      ? emptyMessage
      : selected.length === 0
        ? placeholder
        : null;

  const toggleOption = (name: string) => {
    const next = value.includes(name)
      ? value.filter((item) => item !== name)
      : [...value, name];
    onChange(next);
  };

  return (
    <Field label={label}>
      <div className={styles.root} ref={rootRef}>
        <button
          type="button"
          className={[
            inputStyles.select,
            styles.trigger,
            open ? styles.triggerOpen : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={toggle}
          disabled={isDisabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={styles.value}>
            {triggerLabel ? (
              <span className={styles.placeholder}>{triggerLabel}</span>
            ) : (
              selected.map((option) => (
                <span
                  key={option.name}
                  className={[styles.tag, styles.tagDisplay].join(" ")}
                  style={providerLabelTagVars(option.color)}
                >
                  {option.name}
                </span>
              ))
            )}
          </span>
          <PopoverChevron open={open} className={popoverStyles.chevron} />
        </button>

        {open && options.length > 0 && (
          <div
            className={[
              popoverStyles.menu,
              popoverStyles.menuLeft,
              styles.menu,
            ].join(" ")}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
          >
            <div className={styles.menuList}>
              {options.map((option) => {
                const isSelected = value.includes(option.name);
                return (
                  <label
                    key={option.name}
                    className={styles.option}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span
                      className={styles.tag}
                      style={providerLabelTagVars(option.color)}
                    >
                      <input
                        type="checkbox"
                        className={styles.tagCheckbox}
                        checked={isSelected}
                        onChange={() => toggleOption(option.name)}
                      />
                      {option.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
