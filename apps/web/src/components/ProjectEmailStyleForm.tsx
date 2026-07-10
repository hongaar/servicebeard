import {
  EMAIL_STYLE_PRESETS,
  INBOUND_ACK_TEMPLATE_VARIABLES,
  logoDataUri,
  MAX_LOGO_BYTES,
  OUTBOUND_COMMENT_TEMPLATE_VARIABLES,
  renderInboundAckTemplate,
  renderOutboundCommentTemplate,
  renderPlainEmailPreviewHtml,
  renderStyledEmailHtml,
  templatePreviewVariables,
  type EmailStyleConfig,
  type EmailStylePreset,
} from "@servicebeard/shared";
import { markdownToHtml } from "@servicebeard/shared/email-content";
import { useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { Checkbox, Field, Input } from "./Input";
import inputStyles from "./Input.module.css";
import editorStyles from "./MarkdownEditor.module.css";
import styles from "./ProjectEmailStyleForm.module.css";
import { RadioCardGroup } from "./RadioCardGroup";

const SAMPLE_QUOTED_EMAIL = {
  fromName: "Jane Customer",
  fromEmail: "jane@example.com",
  date: new Date("2026-06-01T10:30:00Z"),
  body: "Hi, I'm having trouble with my recent order. Could you help?",
};

type PreviewKind = "ack" | "reply";

interface ProjectEmailStyleFormProps {
  preset: EmailStylePreset;
  config: EmailStyleConfig;
  ackTemplate: string;
  replyTemplate: string;
  onPresetChange: (preset: EmailStylePreset) => void;
  onConfigChange: (config: EmailStyleConfig) => void;
  disabled?: boolean;
}

const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/svg+xml",
  "image/webp",
];

function buildPreviewContentMarkdown(
  previewKind: PreviewKind,
  ackTemplate: string,
  replyTemplate: string,
): string {
  const ackVars = templatePreviewVariables(INBOUND_ACK_TEMPLATE_VARIABLES);
  const replyVars = templatePreviewVariables(
    OUTBOUND_COMMENT_TEMPLATE_VARIABLES,
  );

  if (previewKind === "ack") {
    return renderInboundAckTemplate(ackTemplate, {
      senderName: ackVars.senderName,
      senderEmail: ackVars.senderEmail,
      subject: ackVars.subject,
      issueNumber: Number(ackVars.issueNumber),
      issueUrl: ackVars.issueUrl,
    });
  }

  return renderOutboundCommentTemplate(replyTemplate, {
    commentBody: replyVars.commentBody,
    authorName: replyVars.authorName,
    issueNumber: Number(replyVars.issueNumber),
    issueUrl: replyVars.issueUrl,
  });
}

export function ProjectEmailStyleForm({
  preset,
  config,
  ackTemplate,
  replyTemplate,
  onPresetChange,
  onConfigChange,
  disabled,
}: ProjectEmailStyleFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("ack");
  const [logoError, setLogoError] = useState("");

  const updateConfig = (patch: Partial<EmailStyleConfig>) => {
    onConfigChange({ ...config, ...patch });
  };

  const handleLogoUpload = async (file: File | undefined) => {
    setLogoError("");
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Logo must be PNG, JPEG, GIF, SVG, or WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Logo must be ${MAX_LOGO_BYTES / 1024} KB or smaller.`);
      return;
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    updateConfig({
      logo: {
        data: btoa(binary),
        contentType: file.type,
      },
    });
  };

  const previewHtml = useMemo(() => {
    const contentMarkdown = buildPreviewContentMarkdown(
      previewKind,
      ackTemplate,
      replyTemplate,
    );
    const contentHtml = markdownToHtml(contentMarkdown);
    const logoSrc =
      config.logo && preset === "branded" ? logoDataUri(config.logo) : null;

    if (preset === "none") {
      return renderPlainEmailPreviewHtml(contentHtml, SAMPLE_QUOTED_EMAIL);
    }

    return renderStyledEmailHtml({
      preset,
      config,
      contentHtml,
      quoted: SAMPLE_QUOTED_EMAIL,
      logoSrc,
    });
  }, [preset, config, ackTemplate, replyTemplate, previewKind]);

  return (
    <div>
      <RadioCardGroup
        name="emailStylePreset"
        label="Email style"
        hint="Optional HTML wrapper for acknowledgement and comment reply emails. Conversation quotes are preserved for reply detection."
        value={preset}
        onChange={(value) => onPresetChange(value as EmailStylePreset)}
        options={EMAIL_STYLE_PRESETS.map((option) => ({
          value: option.id,
          label: option.label,
          description: option.description,
        }))}
      />

      <div className={styles.configPreviewLayout}>
        <div className={styles.configColumn}>
          {preset === "none" ? (
            <p className={styles.noConfig}>No configuration available</p>
          ) : (
            <>
              <Field
                label="Primary color"
                hint="Used for accents and the branded header bar."
              >
                <div className={styles.colorRow}>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={config.primaryColor}
                    disabled={disabled}
                    onChange={(e) =>
                      updateConfig({ primaryColor: e.target.value })
                    }
                    aria-label="Primary color"
                  />
                  <input
                    type="text"
                    className={[inputStyles.input, styles.colorText]
                      .filter(Boolean)
                      .join(" ")}
                    value={config.primaryColor}
                    disabled={disabled}
                    onChange={(e) =>
                      updateConfig({ primaryColor: e.target.value })
                    }
                    pattern="^#[0-9a-fA-F]{6}$"
                    spellCheck={false}
                    aria-label="Primary color hex value"
                  />
                </div>
              </Field>

              {preset === "branded" && (
                <Field
                  label="Logo"
                  hint="Embedded in the email header. PNG, JPEG, GIF, SVG, or WebP up to 100 KB."
                  error={logoError}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_LOGO_TYPES.join(",")}
                    disabled={disabled}
                    onChange={(e) => {
                      void handleLogoUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {config.logo && (
                    <div className={styles.logoPreview}>
                      <img src={logoDataUri(config.logo)} alt="Logo preview" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        disabled={disabled}
                        onClick={() => updateConfig({ logo: null })}
                      >
                        Remove logo
                      </Button>
                    </div>
                  )}
                </Field>
              )}

              <div className={styles.fieldRow}>
                <div className={styles.hideFieldRow}>
                  <Input
                    label="Team name"
                    value={config.teamName}
                    disabled={disabled || !config.showTeamName}
                    onChange={(e) => updateConfig({ teamName: e.target.value })}
                  />
                  <Checkbox
                    label="Do not show"
                    checked={!config.showTeamName}
                    disabled={disabled}
                    onChange={(hide) => updateConfig({ showTeamName: !hide })}
                  />
                </div>
                <div className={styles.hideFieldRow}>
                  <Input
                    label="Project name"
                    value={config.projectName}
                    disabled={disabled || !config.showProjectName}
                    onChange={(e) =>
                      updateConfig({ projectName: e.target.value })
                    }
                  />
                  <Checkbox
                    label="Do not show"
                    checked={!config.showProjectName}
                    disabled={disabled}
                    onChange={(hide) =>
                      updateConfig({ showProjectName: !hide })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.previewColumn}>
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>Preview</span>
              <div className={editorStyles.modeToggle}>
                <button
                  type="button"
                  className={[
                    editorStyles.modeButton,
                    previewKind === "ack" ? editorStyles.modeButtonActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setPreviewKind("ack")}
                >
                  Acknowledgement
                </button>
                <button
                  type="button"
                  className={[
                    editorStyles.modeButton,
                    previewKind === "reply"
                      ? editorStyles.modeButtonActive
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setPreviewKind("reply")}
                >
                  Comment reply
                </button>
              </div>
            </div>
            <div className={styles.previewFrame}>
              {previewHtml && (
                <div
                  className={
                    preset === "none" ? styles.previewFramePlain : undefined
                  }
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
