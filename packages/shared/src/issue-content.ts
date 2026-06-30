import type { ProviderType } from "./constants";

export const INTERNAL_MARKER = "[internal]";

const INTERNAL_MARKER_START = /^\[internal\]\s*/i;
const INTERNAL_MARKER_END = /\s*\[internal\]$/i;

/** True when the comment starts or ends with the `[internal]` marker (case-insensitive). */
export function isServicebeardInternalContent(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  return INTERNAL_MARKER_START.test(trimmed) || INTERNAL_MARKER_END.test(trimmed);
}

export interface IssueSupportDetailsOptions {
  webUrl: string;
  teamId: string;
  projectId: string;
  provider?: ProviderType;
}

export function buildProjectSettingsUrl(
  webUrl: string,
  teamId: string,
  projectId: string,
): string {
  const base = webUrl.replace(/\/$/, "");
  return `${base}/teams/${teamId}/projects/${projectId}`;
}

export function resolveServicebeardWebUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

export function buildIssueSupportDetailsFooter(
  options: IssueSupportDetailsOptions,
): string {
  const projectUrl = buildProjectSettingsUrl(
    options.webUrl,
    options.teamId,
    options.projectId,
  );
  const webUrl = options.webUrl.replace(/\/$/, "");

  const internalHint =
    options.provider === "gitlab"
      ? `Team comments that should not email the customer: include \`${INTERNAL_MARKER}\` at the start or end of the comment, or post as an Internal note in GitLab.`
      : `Team comments that should not email the customer: include \`${INTERNAL_MARKER}\` at the start or end of the comment.`;

  const body = `Created automatically by [ServiceBeard](${webUrl}). [Open project](${projectUrl}).

${internalHint}`;

  if (options.provider === "linear") {
    return `---

### Support details

${body}`;
  }

  return `<details>
<summary>Support details</summary>

${body}

</details>`;
}
