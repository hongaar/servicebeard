import { markdownToHtml } from "@servicebeard/shared/email-content";
import { renderTemplate } from "@servicebeard/shared";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { insertLink, prefixLines, wrapSelection } from "../lib/markdownEditor";
import { Field } from "./Input";
import styles from "./MarkdownEditor.module.css";

type EditorMode = "write" | "preview";

interface MarkdownEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: React.ReactNode;
  disabled?: boolean;
  error?: string;
  labelAction?: React.ReactNode;
  previewVariables?: Record<string, string>;
}

function applyEdit(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (value: string) => void,
  edit: (
    value: string,
    start: number,
    end: number,
  ) => { value: string; selectionStart: number; selectionEnd: number },
) {
  const { selectionStart, selectionEnd } = textarea;
  const result = edit(value, selectionStart, selectionEnd);
  onChange(result.value);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
}

export function MarkdownEditor({
  label,
  value,
  onChange,
  rows = 8,
  hint,
  disabled,
  error,
  labelAction,
  previewVariables,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<EditorMode>("write");

  const previewHtml = useMemo(() => {
    if (!value.trim()) return "";
    const rendered = previewVariables
      ? renderTemplate(value, previewVariables)
      : value;
    return markdownToHtml(rendered);
  }, [value, previewVariables]);

  const runToolbarAction = (
    edit: (
      value: string,
      start: number,
      end: number,
    ) => { value: string; selectionStart: number; selectionEnd: number },
  ) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    applyEdit(textarea, value, onChange, edit);
  };

  return (
    <Field label={label} error={error} hint={hint} labelAction={labelAction}>
      <div className={styles.editor}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toolbarButton}
            title="Bold"
            aria-label="Bold"
            disabled={disabled || mode === "preview"}
            onClick={() =>
              runToolbarAction((v, s, e) => wrapSelection(v, s, e, "**", "**"))
            }
          >
            <Bold size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            title="Italic"
            aria-label="Italic"
            disabled={disabled || mode === "preview"}
            onClick={() =>
              runToolbarAction((v, s, e) => wrapSelection(v, s, e, "*", "*"))
            }
          >
            <Italic size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            title="Link"
            aria-label="Link"
            disabled={disabled || mode === "preview"}
            onClick={() => runToolbarAction(insertLink)}
          >
            <Link2 size={16} aria-hidden />
          </button>
          <span className={styles.toolbarDivider} aria-hidden />
          <button
            type="button"
            className={styles.toolbarButton}
            title="Bullet list"
            aria-label="Bullet list"
            disabled={disabled || mode === "preview"}
            onClick={() =>
              runToolbarAction((v, s, e) => prefixLines(v, s, e, "- "))
            }
          >
            <List size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            title="Numbered list"
            aria-label="Numbered list"
            disabled={disabled || mode === "preview"}
            onClick={() =>
              runToolbarAction((v, s, e) => prefixLines(v, s, e, "1. "))
            }
          >
            <ListOrdered size={16} aria-hidden />
          </button>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={[
                styles.modeButton,
                mode === "write" ? styles.modeButtonActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => setMode("write")}
            >
              Write
            </button>
            <button
              type="button"
              className={[
                styles.modeButton,
                mode === "preview" ? styles.modeButtonActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>
          </div>
        </div>
        {mode === "write" ? (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            disabled={disabled}
            spellCheck
          />
        ) : (
          <div className={styles.preview}>
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className={styles.previewEmpty}>Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
