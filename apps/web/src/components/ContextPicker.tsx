import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { iconSm } from "../lib/icons";
import styles from "./ContextPicker.module.css";
import popoverStyles from "./Popover.module.css";
import { PopoverChevron, usePopover } from "./usePopover.tsx";

interface PickerOption {
  id: string;
  label: string;
}

interface ContextPickerProps {
  prefix: string;
  placeholder: string;
  value: string | undefined;
  options: PickerOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ContextPicker({
  prefix,
  placeholder,
  value,
  options,
  onChange,
  disabled,
}: ContextPickerProps) {
  const { open, toggle, close, rootRef } = usePopover();
  const selected = options.find((o) => o.id === value);
  const display = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  return (
    <div className={popoverStyles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={styles.prefix}>{prefix}</span>
        <span
          className={[
            styles.value,
            isPlaceholder ? styles.valuePlaceholder : "",
          ].join(" ")}
        >
          {options.length === 0 ? "None yet" : display}
        </span>
        <PopoverChevron open={open} className={popoverStyles.chevron} />
      </button>

      {open && (
        <div
          className={[popoverStyles.menu, popoverStyles.menuLeft].join(" ")}
          role="listbox"
        >
          {options.length === 0 ? (
            <p className={popoverStyles.menuEmpty}>Nothing to pick yet</p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className={[
                  popoverStyles.menuItem,
                  opt.id === value ? popoverStyles.menuItemActive : "",
                ].join(" ")}
                onClick={() => {
                  onChange(opt.id);
                  close();
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface BreadcrumbPickerProps {
  label: string;
  to?: string;
  params?: Record<string, string>;
  asLink: boolean;
  ariaCurrent?: boolean;
  icon?: ReactNode;
  options: PickerOption[];
  value: string | undefined;
  onChange: (id: string) => void;
  menuLabel: string;
  linkClassName: string;
  currentClassName: string;
  iconClassName: string;
}

export function BreadcrumbPicker({
  label,
  to,
  params,
  asLink,
  ariaCurrent,
  icon,
  options,
  value,
  onChange,
  menuLabel,
  linkClassName,
  currentClassName,
  iconClassName,
}: BreadcrumbPickerProps) {
  const { open, toggle, close, rootRef } = usePopover();
  const hasOptions = options.length > 0;

  return (
    <div
      className={[popoverStyles.root, styles.breadcrumbPicker].join(" ")}
      ref={rootRef}
    >
      <span className={styles.breadcrumbPickerInner}>
        {asLink && to ? (
          <Link
            to={to}
            params={params}
            className={[linkClassName, styles.breadcrumbPickerLabel].join(" ")}
          >
            {icon && (
              <span
                className={[iconClassName, styles.breadcrumbPickerIcon]
                  .filter(Boolean)
                  .join(" ")}
              >
                {icon}
              </span>
            )}
            {label}
          </Link>
        ) : (
          <span
            className={[currentClassName, styles.breadcrumbPickerLabel].join(
              " ",
            )}
            aria-current={ariaCurrent ? "page" : undefined}
          >
            {icon && (
              <span
                className={[iconClassName, styles.breadcrumbPickerIcon]
                  .filter(Boolean)
                  .join(" ")}
              >
                {icon}
              </span>
            )}
            {label}
          </span>
        )}
        <button
          type="button"
          className={styles.breadcrumbPickerTrigger}
          onClick={toggle}
          disabled={!hasOptions}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={menuLabel}
        >
          <PopoverChevron
            open={open}
            className={styles.breadcrumbPickerChevron}
          />
        </button>
      </span>

      {open && hasOptions && (
        <div
          className={[popoverStyles.menu, popoverStyles.menuLeft].join(" ")}
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.id === value}
              className={[
                popoverStyles.menuItem,
                opt.id === value ? popoverStyles.menuItemActive : "",
              ].join(" ")}
              onClick={() => {
                onChange(opt.id);
                close();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface BreadcrumbTeamPickerProps {
  label: string;
  to?: string;
  params?: Record<string, string>;
  asLink: boolean;
  ariaCurrent?: boolean;
  icon?: ReactNode;
  teams: { id: string; name: string }[];
  teamId?: string;
  linkClassName: string;
  currentClassName: string;
  iconClassName: string;
}

export function BreadcrumbTeamPicker({
  teams,
  teamId,
  ...props
}: BreadcrumbTeamPickerProps) {
  const navigate = useNavigate();

  return (
    <BreadcrumbPicker
      {...props}
      options={teams.map((t) => ({ id: t.id, label: t.name }))}
      value={teamId}
      onChange={(id) => {
        navigate({ to: "/teams/$teamId/projects", params: { teamId: id } });
      }}
      menuLabel="Switch team"
    />
  );
}

interface BreadcrumbProjectPickerProps {
  label: string;
  to?: string;
  params?: Record<string, string>;
  asLink: boolean;
  ariaCurrent?: boolean;
  icon?: ReactNode;
  projects: { id: string; name: string }[];
  teamId: string;
  projectId?: string;
  section?: string;
  linkClassName: string;
  currentClassName: string;
  iconClassName: string;
}

export function BreadcrumbProjectPicker({
  projects,
  teamId,
  projectId,
  section = "overview",
  ...props
}: BreadcrumbProjectPickerProps) {
  const navigate = useNavigate();

  return (
    <BreadcrumbPicker
      {...props}
      options={projects.map((p) => ({ id: p.id, label: p.name }))}
      value={projectId}
      onChange={(id) => {
        navigate({
          to: "/teams/$teamId/projects/$projectId/$section",
          params: { teamId, projectId: id, section },
        });
      }}
      menuLabel="Switch project"
    />
  );
}

interface BackLinkProps {
  to: string;
  params?: Record<string, string>;
  children: React.ReactNode;
}

export function BackLink({ to, params, children }: BackLinkProps) {
  return (
    <Link to={to} params={params} className={styles.backLink}>
      <ArrowLeft {...iconSm} />
      {children}
    </Link>
  );
}
