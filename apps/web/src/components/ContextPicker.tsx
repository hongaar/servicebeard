import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
        <span className={[styles.value, isPlaceholder ? styles.valuePlaceholder : ""].join(" ")}>
          {options.length === 0 ? "None yet" : display}
        </span>
        <PopoverChevron open={open} className={popoverStyles.chevron} />
      </button>

      {open && (
        <div className={[popoverStyles.menu, popoverStyles.menuLeft].join(" ")} role="listbox">
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

interface TeamPickerProps {
  teams: { id: string; name: string }[];
  teamId?: string;
}

export function TeamPicker({ teams, teamId }: TeamPickerProps) {
  const navigate = useNavigate();

  return (
    <ContextPicker
      prefix="Team"
      placeholder="Choose…"
      value={teamId}
      options={teams.map((t) => ({ id: t.id, label: t.name }))}
      onChange={(id) => {
        navigate({ to: "/teams/$teamId/projects", params: { teamId: id } });
      }}
    />
  );
}

interface ProjectPickerProps {
  projects: { id: string; name: string }[];
  teamId: string;
  projectId?: string;
  section?: string;
}

export function ProjectPicker({
  projects,
  teamId,
  projectId,
  section = "rules",
}: ProjectPickerProps) {
  const navigate = useNavigate();

  return (
    <ContextPicker
      prefix="Project"
      placeholder="Choose…"
      value={projectId}
      options={projects.map((p) => ({ id: p.id, label: p.name }))}
      onChange={(id) => {
        navigate({
          to: "/teams/$teamId/projects/$projectId/$section",
          params: { teamId, projectId: id, section },
        });
      }}
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
