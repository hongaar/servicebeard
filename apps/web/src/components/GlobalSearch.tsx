import { useNavigate } from "@tanstack/react-router";
import { CircleHelp, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIN_QUERY_LENGTH, useGlobalSearchQuery } from "../hooks/useGlobalSearch";
import {
    buildSearchActions,
    filterSearchActions,
    searchActionsToItems,
    type GlobalSearchContext,
    type GlobalSearchResultItem,
} from "../lib/globalSearch";
import { apiResultsToItems, groupSearchResults } from "../lib/globalSearchResults";
import { iconMd, iconSm } from "../lib/icons";
import { NAV_ICONS, type NavIconKey } from "../lib/navigation";
import styles from "./GlobalSearch.module.css";

interface GlobalSearchProps {
  context: GlobalSearchContext;
}

function isMacPlatform() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function ResultIcon({ icon }: { icon?: NavIconKey }) {
  if (!icon) return <CircleHelp {...iconSm} className={styles.resultIcon} />;
  const Icon = NAV_ICONS[icon];
  return <Icon {...iconSm} className={styles.resultIcon} />;
}

export function GlobalSearch({ context }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearchQuery(query);
  const shortcutLabel = isMacPlatform() ? "⌘K" : "Ctrl+K";

  const actionItems = useMemo(() => {
    const actions = buildSearchActions(context);
    return searchActionsToItems(filterSearchActions(actions, query));
  }, [context, query]);

  const resourceItems = useMemo(
    () => (data ? apiResultsToItems(data) : []),
    [data],
  );

  const groups = useMemo(
    () => groupSearchResults([...actionItems, ...resourceItems]),
    [actionItems, resourceItems],
  );

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const selectItem = useCallback(
    (item: GlobalSearchResultItem) => {
      setOpen(false);
      setQuery("");
      navigate({ to: item.to, params: item.params });
    },
    [navigate],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, flatItems.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (flatItems.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => (index + 1) % flatItems.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => (index - 1 + flatItems.length) % flatItems.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) selectItem(item);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatItems, selectedIndex, selectItem]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const showLoading = query.trim().length >= MIN_QUERY_LENGTH && isFetching;
  let itemIndex = -1;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={`Search (${shortcutLabel})`}
      >
        <Search {...iconSm} />
        <span className={styles.triggerLabel}>Search…</span>
        <kbd className={styles.triggerShortcut}>{shortcutLabel}</kbd>
      </button>

      {open && (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={styles.palette}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.inputRow}>
              <Search {...iconMd} className={styles.inputIcon} />
              <input
                ref={inputRef}
                type="search"
                className={styles.input}
                placeholder="Search pages, teams, projects, conversations…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {showLoading && <Loader2 {...iconSm} className={styles.spinner} />}
            </div>

            <div className={styles.results} ref={listRef}>
              {flatItems.length === 0 && !showLoading && (
                <p className={styles.empty}>
                  {query.trim().length >= MIN_QUERY_LENGTH
                    ? "No results found."
                    : "Type to search navigation and resources."}
                </p>
              )}

              {groups.map((group) => (
                <div key={group.label} className={styles.group}>
                  <p className={styles.groupLabel}>{group.label}</p>
                  <ul className={styles.groupList}>
                    {group.items.map((item) => {
                      itemIndex += 1;
                      const index = itemIndex;
                      const active = index === selectedIndex;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={[styles.result, active ? styles.resultActive : ""]
                              .filter(Boolean)
                              .join(" ")}
                            data-index={index}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onClick={() => selectItem(item)}
                          >
                            <ResultIcon icon={item.icon} />
                            <span className={styles.resultText}>
                              <span className={styles.resultLabel}>{item.label}</span>
                              {item.description && (
                                <span className={styles.resultDescription}>{item.description}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
