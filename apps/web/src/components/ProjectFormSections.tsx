import {
  detectIssueProviderFromUrl,
  lookupMailAutoconfig,
  parseGithubRepository,
  parseLinearTeam,
  usesLocalPartMailAuth,
} from "@servicebeard/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useInstanceConfig } from "../hooks/useInstanceConfig";
import { api } from "../lib/api";
import { DOC_PATHS } from "../lib/docs";
import {
  isGithubAppInstallMessage,
  openGithubAppInstallPopup,
} from "../lib/githubAppInstall";
import {
  applyIssueRepositoryUrl,
  applyProjectName,
  applyProvider,
  applyProviderHosting,
  applySupportEmailAutoconfig,
  formToMailConfig,
  formToProviderConfig,
  githubProviderCredentialsReady,
  isMailServerConfigured,
  type ProjectSettingsFormValues,
  type ProviderHosting,
} from "../lib/projectForm";
import styles from "../styles/pages.module.css";
import { BlockedMailPortWarning } from "./BlockedMailPortWarning";
import { Button } from "./Button";
import { DocsLink } from "./DocsLink";
import { Checkbox, Input, Textarea } from "./Input";
import { ProviderLogo } from "./ProviderLogo";
import { PublicRepoMailWarning } from "./PublicRepoMailWarning";
import { RadioCardGroup } from "./RadioCardGroup";

type FormUpdater = (
  field: keyof ProjectSettingsFormValues,
  value: string | number | boolean,
) => void;

function connectionErrorMessage(
  result: { error?: string; responseBody?: string },
  fallback = "Connection failed",
): string {
  return (
    [result.error, result.responseBody].filter(Boolean).join(" — ") || fallback
  );
}

interface SectionProps {
  values: ProjectSettingsFormValues;
  onChange: FormUpdater;
  fieldErrors?: Partial<Record<keyof ProjectSettingsFormValues, string>>;
  onClearFieldError?: (field: keyof ProjectSettingsFormValues) => void;
}

interface MailSectionProps extends SectionProps {
  mode: "create" | "edit";
  teamId: string;
  projectId?: string;
}

interface ProviderSectionProps extends SectionProps {
  mode: "create" | "edit";
  teamId: string;
  projectId?: string;
}

function setField(
  onChange: FormUpdater,
  onClearFieldError: SectionProps["onClearFieldError"],
  field: keyof ProjectSettingsFormValues,
) {
  return (value: string | number | boolean) => {
    onClearFieldError?.(field);
    onChange(field, value);
  };
}

export function ProjectNameSection({
  values,
  onChange,
  mode,
  fieldErrors,
  onClearFieldError,
}: SectionProps & { mode: "create" | "edit" }) {
  return (
    <div className={styles.formSection}>
      <h3 className={styles.sectionTitle}>Project name</h3>
      <p className={styles.formHint}>
        A short label for this mailbox connection, e.g. “Acme Support”.
      </p>
      <Input
        label="Name"
        value={values.name}
        error={fieldErrors?.name}
        autoFocus={mode === "create"}
        onChange={(e) => {
          if (mode === "create") {
            const next = applyProjectName(values, e.target.value);
            onChange("name", next.name);
            onChange("slug", next.slug);
          } else {
            setField(onChange, onClearFieldError, "name")(e.target.value);
          }
          onClearFieldError?.("name");
        }}
      />
    </div>
  );
}

export function ProjectMailSection({
  values,
  onChange,
  mode,
  fieldErrors,
  onClearFieldError,
  teamId,
  projectId,
}: MailSectionProps) {
  const isCreate = mode === "create";
  const supportEmail = values.smtpFrom.trim();
  const initialAutoconfig = supportEmail
    ? lookupMailAutoconfig(supportEmail)
    : null;
  const initialMailConfigured = isMailServerConfigured(values);

  const [settingsRevealed, setSettingsRevealed] = useState(
    !isCreate || initialMailConfigured,
  );
  const [showFullSettings, setShowFullSettings] = useState(
    !isCreate || (initialMailConfigured && !initialAutoconfig?.providerName),
  );
  const [detectedProvider, setDetectedProvider] = useState<string | null>(
    isCreate && initialMailConfigured && initialAutoconfig?.providerName
      ? initialAutoconfig.providerName
      : null,
  );
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [detectingMail, setDetectingMail] = useState(false);
  const { data: instanceConfig } = useInstanceConfig();

  const patchForm = (patch: Partial<ProjectSettingsFormValues>) => {
    for (const [key, val] of Object.entries(patch)) {
      if (val !== undefined) {
        onChange(
          key as keyof ProjectSettingsFormValues,
          val as string | number | boolean,
        );
      }
    }
  };

  const resetMailSetup = () => {
    setSettingsRevealed(false);
    setShowFullSettings(false);
    setDetectedProvider(null);
    setTestState("idle");
    setTestMessage("");
    setDetectingMail(false);
  };

  const handleSupportEmail = (email: string) => {
    onClearFieldError?.("smtpFrom");
    if (isCreate) {
      onChange("smtpFrom", email);
      resetMailSetup();
      return;
    }
    patchForm(applySupportEmailAutoconfig(values, email));
    setTestState("idle");
    setTestMessage("");
  };

  const runAutodetect = async () => {
    const email = values.smtpFrom.trim();
    if (!email) return;

    const knownAutoconfig = lookupMailAutoconfig(email);
    if (knownAutoconfig?.providerName) {
      patchForm(applySupportEmailAutoconfig(values, email, knownAutoconfig));
      setSettingsRevealed(true);
      setDetectedProvider(knownAutoconfig.providerName);
      setShowFullSettings(false);
      setTestState("idle");
      setTestMessage("");
      return;
    }

    setDetectingMail(true);
    setTestState("idle");
    setTestMessage("");
    try {
      const result = await api.discoverMail(teamId, { email });
      if (result.found && result.config) {
        patchForm(applySupportEmailAutoconfig(values, email, result.config));
        setSettingsRevealed(true);
        setDetectedProvider(
          result.config.providerName ?? email.split("@")[1] ?? "mail server",
        );
        setShowFullSettings(false);
      } else {
        patchForm(applySupportEmailAutoconfig(values, email));
        setSettingsRevealed(true);
        setDetectedProvider(null);
        setShowFullSettings(true);
      }
    } catch {
      patchForm(applySupportEmailAutoconfig(values, email));
      setSettingsRevealed(true);
      setDetectedProvider(null);
      setShowFullSettings(true);
    } finally {
      setDetectingMail(false);
    }
  };

  const showManualSettings = () => {
    const email = values.smtpFrom.trim();
    if (!email) return;
    const mailUser = usesLocalPartMailAuth(email)
      ? email.slice(0, email.indexOf("@"))
      : email;
    patchForm({ smtpFrom: email, imapUser: mailUser, smtpUser: mailUser });
    setSettingsRevealed(true);
    setShowFullSettings(true);
    setDetectedProvider(null);
    setTestState("idle");
    setTestMessage("");
  };

  const handleMailboxPassword = (password: string) => {
    onClearFieldError?.("imapPassword");
    onClearFieldError?.("smtpPassword");
    onChange("imapPassword", password);
    onChange("smtpPassword", password);
  };

  const testMail = async () => {
    setTestState("testing");
    setTestMessage("");
    const data = formToMailConfig(values);
    try {
      const result = projectId
        ? await api.testMail(teamId, projectId, data)
        : await api.testMailForTeam(teamId, data);
      if (result.ok) {
        setTestState("ok");
        setTestMessage("IMAP and SMTP connections succeeded.");
      } else {
        setTestState("error");
        setTestMessage(connectionErrorMessage(result));
        if (isCreate) setShowFullSettings(true);
      }
    } catch (err) {
      setTestState("error");
      setTestMessage(err instanceof Error ? err.message : "Connection failed");
      if (isCreate) setShowFullSettings(true);
    }
  };

  const canTest =
    values.imapHost &&
    values.imapUser &&
    values.imapPassword &&
    values.smtpHost &&
    values.smtpUser &&
    values.smtpPassword;

  const hasSupportEmail = values.smtpFrom.trim().length > 0;
  const passwordOnly =
    isCreate &&
    settingsRevealed &&
    Boolean(detectedProvider) &&
    !showFullSettings;
  const showMailSettings = !isCreate || settingsRevealed;

  const mailPasswordHint =
    detectedProvider === "Gmail" || detectedProvider === "iCloud"
      ? "Use an app-specific password if two-factor authentication is enabled."
      : undefined;

  return (
    <div className={styles.formSection}>
      <h3 className={styles.sectionTitle}>Support mailbox</h3>
      <p className={styles.formHint}>
        The inbox that receives customer emails.
        {isCreate
          ? " Enter the address, then auto-detect or enter server settings manually."
          : " Used for IMAP/SMTP login and as the email address on outbound replies."}{" "}
        <DocsLink to={DOC_PATHS.mailbox}>Mailbox setup guide</DocsLink>
      </p>

      <Input
        label="Support email address"
        type="email"
        value={values.smtpFrom}
        error={fieldErrors?.smtpFrom}
        onChange={(e) => handleSupportEmail(e.target.value)}
        hint="The inbox that receives customer emails."
      />

      <Input
        label="From display name"
        value={values.smtpFromName}
        onChange={(e) => onChange("smtpFromName", e.target.value)}
        hint="Optional. Shown to customers on replies (e.g. Acme Support)."
      />

      {isCreate && hasSupportEmail && !settingsRevealed && (
        <div className={styles.detectRow}>
          <Button
            type="button"
            variant="secondary"
            onClick={runAutodetect}
            disabled={detectingMail}
          >
            {detectingMail ? (
              <>
                <Loader2 size={16} className={styles.spinIcon} aria-hidden />
                Detecting mail settings…
              </>
            ) : (
              "Auto-detect mail settings"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={showManualSettings}
            disabled={detectingMail}
          >
            Enter manually
          </Button>
        </div>
      )}

      {showMailSettings && passwordOnly && (
        <p className={styles.autoconfigHint}>
          Detected {detectedProvider} — we&apos;ll use the discovered server
          settings for this mailbox.
        </p>
      )}

      {showMailSettings &&
        detectedProvider &&
        showFullSettings &&
        isCreate &&
        testState === "error" && (
          <p
            className={[
              styles.autoconfigHint,
              styles.autoconfigHintWarning,
            ].join(" ")}
          >
            Couldn&apos;t connect with the default {detectedProvider} settings —
            check or adjust the server details below.
          </p>
        )}

      {showMailSettings &&
        !detectedProvider &&
        showFullSettings &&
        isCreate &&
        settingsRevealed && (
          <p className={styles.autoconfigHint}>
            No known provider for this domain — enter your mail server settings
            below.
          </p>
        )}

      {showMailSettings &&
        (passwordOnly ? (
          <>
            <Input
              label="Mailbox password"
              type="password"
              value={values.imapPassword}
              error={fieldErrors?.imapPassword ?? fieldErrors?.smtpPassword}
              onChange={(e) => handleMailboxPassword(e.target.value)}
              hint={mailPasswordHint}
            />
            <BlockedMailPortWarning
              protocol="imap"
              port={values.imapPort}
              config={instanceConfig}
            />
            <BlockedMailPortWarning
              protocol="smtp"
              port={values.smtpPort}
              config={instanceConfig}
            />
          </>
        ) : (
          <div className={styles.mailServerFields}>
            <h4 className={styles.subsectionTitle}>IMAP (incoming)</h4>
            <div className={styles.row}>
              <Input
                label="Host"
                value={values.imapHost}
                error={fieldErrors?.imapHost}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "imapHost",
                  )(e.target.value)
                }
              />
              <div>
                <Input
                  label="Port"
                  type="number"
                  value={values.imapPort}
                  error={fieldErrors?.imapPort}
                  onChange={(e) =>
                    setField(
                      onChange,
                      onClearFieldError,
                      "imapPort",
                    )(Number(e.target.value))
                  }
                />
                <BlockedMailPortWarning
                  protocol="imap"
                  port={values.imapPort}
                  config={instanceConfig}
                />
              </div>
            </div>
            <div className={styles.row}>
              <Input
                label="User"
                value={values.imapUser}
                error={fieldErrors?.imapUser}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "imapUser",
                  )(e.target.value)
                }
              />
              <Input
                label="Password"
                type="password"
                value={values.imapPassword}
                error={fieldErrors?.imapPassword}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "imapPassword",
                  )(e.target.value)
                }
                placeholder={
                  mode === "edit"
                    ? "Leave blank to keep current password"
                    : undefined
                }
              />
            </div>
            <Checkbox
              label="IMAP TLS"
              checked={values.imapSecure}
              onChange={(v) => onChange("imapSecure", v)}
            />
            <Checkbox
              label="Mark ingested messages as read in IMAP"
              checked={values.imapMarkIngestedAsSeen}
              onChange={(v) => onChange("imapMarkIngestedAsSeen", v)}
              hint="When enabled, messages are marked as read in your mail client after this project ingests them."
            />

            <h4 className={styles.subsectionTitle}>SMTP (outgoing)</h4>
            <div className={styles.row}>
              <Input
                label="Host"
                value={values.smtpHost}
                error={fieldErrors?.smtpHost}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "smtpHost",
                  )(e.target.value)
                }
              />
              <div>
                <Input
                  label="Port"
                  type="number"
                  value={values.smtpPort}
                  error={fieldErrors?.smtpPort}
                  onChange={(e) =>
                    setField(
                      onChange,
                      onClearFieldError,
                      "smtpPort",
                    )(Number(e.target.value))
                  }
                />
                <BlockedMailPortWarning
                  protocol="smtp"
                  port={values.smtpPort}
                  config={instanceConfig}
                />
              </div>
            </div>
            <div className={styles.row}>
              <Input
                label="User"
                value={values.smtpUser}
                error={fieldErrors?.smtpUser}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "smtpUser",
                  )(e.target.value)
                }
              />
              <Input
                label="Password"
                type="password"
                value={values.smtpPassword}
                error={fieldErrors?.smtpPassword}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "smtpPassword",
                  )(e.target.value)
                }
                placeholder={
                  mode === "edit"
                    ? "Leave blank to keep current password"
                    : undefined
                }
              />
            </div>
            <Checkbox
              label="SMTP TLS"
              checked={values.smtpSecure}
              onChange={(v) => onChange("smtpSecure", v)}
            />
          </div>
        ))}

      {showMailSettings && (
        <div className={styles.testRow}>
          <Button
            type="button"
            variant="secondary"
            onClick={testMail}
            disabled={!canTest || testState === "testing"}
          >
            {testState === "testing" ? (
              <>
                <Loader2 size={16} className={styles.spinIcon} /> Testing…
              </>
            ) : (
              "Test mail connection"
            )}
          </Button>
          {testState === "ok" && (
            <span className={styles.testOk}>
              <CheckCircle2 size={16} /> {testMessage}
            </span>
          )}
          {testState === "error" && (
            <span className={styles.testError}>
              <XCircle size={16} /> {testMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const GITLAB_HOSTING_OPTIONS: Array<{
  value: ProviderHosting;
  label: string;
  description: string;
}> = [
  { value: "cloud", label: "Cloud", description: "gitlab.com" },
  {
    value: "self-hosted",
    label: "Self-hosted",
    description: "Your own GitLab instance",
  },
  { value: "dedicated", label: "Dedicated", description: "GitLab Dedicated" },
];

const GITHUB_HOSTING_OPTIONS: Array<{
  value: ProviderHosting;
  label: string;
  description: string;
}> = [
  { value: "cloud", label: "Cloud", description: "github.com" },
  {
    value: "enterprise",
    label: "Enterprise",
    description: "GitHub Enterprise Server",
  },
];

export function ProjectProviderSection({
  values,
  onChange,
  mode,
  fieldErrors,
  onClearFieldError,
  teamId,
  projectId,
}: ProviderSectionProps) {
  const isCreate = mode === "create";
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [githubInstallNotice, setGithubInstallNotice] = useState("");
  const [repoDraft, setRepoDraft] = useState<string | null>(null);
  const [detectionNotice, setDetectionNotice] = useState("");
  const { data: githubApp } = useQuery({
    queryKey: ["github-app-config"],
    queryFn: () => api.getGithubAppConfig(),
    staleTime: 60_000,
  });
  const githubAppEnabled = githubApp?.enabled ?? false;
  const githubAppConfigured = githubApp?.configured ?? false;
  const isGitlab = values.provider === "gitlab";
  const isGithub = values.provider === "github";
  const isLinear = values.provider === "linear";
  const providerSelected = isGitlab || isGithub || isLinear;
  const githubAppInstalled =
    values.providerGithubInstallationId.trim().length > 0;
  const githubRepositorySlug = useMemo(() => {
    if (!isGithub || !values.providerProjectId.trim()) return null;
    try {
      return parseGithubRepository(values.providerProjectId);
    } catch {
      return null;
    }
  }, [isGithub, values.providerProjectId]);
  const gitlabProjectId = useMemo(() => {
    if (!isGitlab || !values.providerProjectId.trim()) return null;
    return values.providerProjectId.trim();
  }, [isGitlab, values.providerProjectId]);
  const repositoryVisibilityTarget = githubRepositorySlug ?? gitlabProjectId;

  const { data: repositoryVisibility } = useQuery({
    queryKey: [
      "repository-visibility",
      teamId,
      values.provider,
      values.providerBaseUrl,
      repositoryVisibilityTarget,
      values.providerTlsInsecure,
    ],
    queryFn: () =>
      api.lookupRepositoryVisibility(teamId, {
        provider: values.provider as "github" | "gitlab",
        baseUrl: values.providerBaseUrl,
        projectId: repositoryVisibilityTarget!,
        providerTlsInsecure: values.providerTlsInsecure,
      }),
    enabled:
      isCreate && Boolean(repositoryVisibilityTarget) && (isGithub || isGitlab),
    staleTime: 60_000,
  });
  const showPublicRepoWarning = repositoryVisibility?.visibility === "public";

  const {
    data: existingInstallation,
    refetch: refetchInstallation,
    isFetching: installationLookupPending,
  } = useQuery({
    queryKey: [
      "github-repo-installation",
      teamId,
      values.providerBaseUrl,
      githubRepositorySlug,
    ],
    queryFn: () =>
      api.lookupGithubRepositoryInstallation(
        teamId,
        values.providerBaseUrl || "https://github.com",
        githubRepositorySlug!,
      ),
    enabled:
      githubAppEnabled && githubAppConfigured && Boolean(githubRepositorySlug),
    staleTime: 30_000,
  });

  const patchForm = (patch: Partial<ProjectSettingsFormValues>) => {
    for (const [key, val] of Object.entries(patch)) {
      if (val !== undefined) {
        onChange(
          key as keyof ProjectSettingsFormValues,
          val as string | number | boolean,
        );
      }
    }
  };

  useEffect(() => {
    if (!isGithub || !githubApp) return;
    if (githubAppEnabled && values.providerGithubAuthType !== "github_app") {
      patchForm({ providerGithubAuthType: "github_app", providerToken: "" });
    }
    if (!githubAppEnabled && values.providerGithubAuthType !== "pat") {
      patchForm({
        providerGithubAuthType: "pat",
        providerGithubInstallationId: "",
      });
    }
  }, [isGithub, githubAppEnabled, githubApp, values.providerGithubAuthType]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isGithubAppInstallMessage(event.data)) return;

      if (event.data.installationId) {
        patchForm({
          providerGithubInstallationId: event.data.installationId,
          providerGithubAuthType: "github_app",
        });
        onClearFieldError?.("providerGithubInstallationId");
        setGithubInstallNotice("GitHub App connected.");
      } else if (event.data.error) {
        setGithubInstallNotice(
          "GitHub App installation did not complete. Try again.",
        );
      }
      void refetchInstallation();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClearFieldError, refetchInstallation]);

  useEffect(() => {
    if (
      !githubAppEnabled ||
      !githubAppConfigured ||
      !githubRepositorySlug ||
      installationLookupPending ||
      !existingInstallation
    ) {
      return;
    }

    if (existingInstallation.installed && existingInstallation.installationId) {
      const id = String(existingInstallation.installationId);
      if (values.providerGithubInstallationId !== id) {
        patchForm({
          providerGithubInstallationId: id,
          providerGithubAuthType: "github_app",
        });
        onClearFieldError?.("providerGithubInstallationId");
      }
      return;
    }

    if (values.providerGithubInstallationId) {
      patchForm({ providerGithubInstallationId: "" });
    }
  }, [
    githubAppEnabled,
    githubAppConfigured,
    githubRepositorySlug,
    installationLookupPending,
    existingInstallation,
    values.providerGithubInstallationId,
    onClearFieldError,
  ]);

  const githubAppConnected =
    githubAppInstalled || Boolean(existingInstallation?.installed);
  const githubAppInstallPending =
    Boolean(githubRepositorySlug) && installationLookupPending;

  const showGitlabBaseUrl =
    isGitlab &&
    (values.providerHosting === "self-hosted" ||
      values.providerHosting === "dedicated");
  const showGithubBaseUrl = isGithub && values.providerHosting === "enterprise";
  const showGitlabTls = isGitlab && values.providerHosting === "self-hosted";

  const testProvider = async () => {
    setTestState("testing");
    setTestMessage("");
    const data = formToProviderConfig(values, { githubAppEnabled });
    try {
      const result = projectId
        ? await api.testProvider(teamId, projectId, data)
        : await api.testProviderForTeam(teamId, data);
      if (result.ok) {
        setTestState("ok");
        setTestMessage(
          result.user
            ? `Connected as ${result.user.username}`
            : "Connection succeeded.",
        );
      } else {
        setTestState("error");
        setTestMessage(connectionErrorMessage(result));
      }
    } catch (err) {
      setTestState("error");
      setTestMessage(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const canTest =
    values.providerBaseUrl &&
    values.providerProjectId &&
    (isGithub
      ? githubProviderCredentialsReady(values, githubAppEnabled)
      : values.providerToken);

  const startGithubAppInstall = () => {
    const url = api.githubAppInstallPath(
      teamId,
      values.providerBaseUrl || "https://github.com",
      { popup: true },
    );
    const popup = openGithubAppInstallPopup(url);
    if (!popup) {
      setGithubInstallNotice(
        "Allow popups for this site to install without leaving the wizard.",
      );
    } else {
      setGithubInstallNotice("");
    }
  };

  const openInstallationSettings = () => {
    const settingsUrl =
      existingInstallation?.settingsUrl ??
      (githubAppInstalled
        ? `https://github.com/settings/installations/${encodeURIComponent(values.providerGithubInstallationId)}`
        : null);
    if (!settingsUrl) return;
    window.open(settingsUrl, "_blank", "noopener,noreferrer");
  };

  const repositoryInputValue = repoDraft ?? values.providerProjectId;

  const handleRepositoryInputBlur = () => {
    const raw = repositoryInputValue.trim();
    if (!raw) {
      setRepoDraft(null);
      setDetectionNotice("");
      patchForm({ providerProjectId: "" });
      return;
    }

    const detected = detectIssueProviderFromUrl(raw);
    const next = applyIssueRepositoryUrl(values, raw);
    patchForm(next);
    setRepoDraft(null);
    onClearFieldError?.("providerProjectId");
    onClearFieldError?.("provider");

    if (detected) {
      const host = new URL(detected.providerBaseUrl).host;
      const providerName =
        detected.provider === "github"
          ? "GitHub"
          : detected.provider === "linear"
            ? "Linear"
            : "GitLab";
      setDetectionNotice(
        `Detected ${providerName} · ${detected.providerProjectId} on ${host}`,
      );
    } else if (next.provider) {
      setDetectionNotice("");
    } else if (raw.includes("://") || /^[^/]+\.[^/]+\//.test(raw)) {
      setDetectionNotice(
        "Could not detect provider — choose GitHub, GitLab, or Linear below.",
      );
    } else {
      setDetectionNotice("");
    }
  };

  return (
    <div className={styles.formSection}>
      <h3 className={styles.sectionTitle}>
        {isCreate ? "Issue repository" : "Issue provider"}
      </h3>
      <p className={styles.formHint}>
        {isCreate
          ? "Paste a GitHub repository, GitLab project, or Linear team/project URL — we'll detect the provider and target automatically."
          : "Where new issues and comment sync should go when mail arrives."}{" "}
        <DocsLink to={DOC_PATHS.issueProviders}>Provider setup guides</DocsLink>
      </p>

      {isCreate && (
        <>
          <Input
            label="Repository, project, or team URL"
            value={repositoryInputValue}
            error={fieldErrors?.providerProjectId}
            autoFocus={isCreate}
            onChange={(e) => {
              onClearFieldError?.("providerProjectId");
              setRepoDraft(e.target.value);
              if (detectionNotice) setDetectionNotice("");
            }}
            onBlur={handleRepositoryInputBlur}
            hint="GitHub: repository URL · GitLab: project URL · Linear: team or project URL"
          />
          {detectionNotice && (
            <p className={styles.formHint}>{detectionNotice}</p>
          )}
        </>
      )}

      {isCreate && !providerSelected && (
        <p className={styles.formHint}>
          Paste a repository, project, or team URL above to auto-detect, or
          choose a provider below.
        </p>
      )}

      <RadioCardGroup
        name="provider"
        label="Provider"
        value={values.provider}
        onChange={(provider) => patchForm(applyProvider(values, provider))}
        options={[
          {
            value: "github",
            label: "GitHub",
            description: "Create issues and sync comments from GitHub.",
            icon: <ProviderLogo provider="github" />,
          },
          {
            value: "gitlab",
            label: "GitLab",
            description: "Create issues and sync comments from GitLab.",
            icon: <ProviderLogo provider="gitlab" />,
          },
          {
            value: "linear",
            label: "Linear",
            description: "Create issues and sync comments from Linear.",
            icon: <ProviderLogo provider="linear" />,
          },
        ]}
      />

      {showPublicRepoWarning && <PublicRepoMailWarning />}

      {providerSelected && isGithub && (
        <>
          <RadioCardGroup
            name="providerHosting"
            label="Hosting"
            value={values.providerHosting}
            onChange={(hosting) =>
              patchForm(
                applyProviderHosting(values, hosting as ProviderHosting),
              )
            }
            options={GITHUB_HOSTING_OPTIONS}
          />

          {showGithubBaseUrl && (
            <Input
              label="Instance URL"
              value={values.providerBaseUrl}
              error={fieldErrors?.providerBaseUrl}
              onChange={(e) =>
                setField(
                  onChange,
                  onClearFieldError,
                  "providerBaseUrl",
                )(e.target.value)
              }
              hint="Root URL of your GitHub Enterprise Server, not the API endpoint."
            />
          )}

          {!isCreate || !values.providerProjectId.trim() ? (
            <Input
              label="Repository"
              value={values.providerProjectId}
              error={fieldErrors?.providerProjectId}
              onChange={(e) =>
                setField(
                  onChange,
                  onClearFieldError,
                  "providerProjectId",
                )(e.target.value)
              }
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (!raw) return;
                try {
                  const normalized = parseGithubRepository(raw);
                  if (normalized !== raw) {
                    patchForm({ providerProjectId: normalized });
                  }
                } catch {
                  // Keep raw input; validation runs on submit.
                }
              }}
              hint="Paste a GitHub repository URL or enter owner/repo (e.g. acme/support)."
            />
          ) : null}

          {githubAppEnabled ? (
            <div className={styles.githubAppBlock}>
              {!githubAppConnected && (
                <p className={styles.formHint}>
                  Grant the ServiceBeard GitHub App access to this repository.
                  Installation opens in a new window so you can keep working in
                  the wizard.
                </p>
              )}

              {githubAppInstallPending && (
                <p className={styles.formHint}>
                  <Loader2 size={14} className={styles.spinIcon} /> Checking for
                  an existing installation…
                </p>
              )}

              {githubAppConnected ? (
                <div className={styles.githubAppStatus}>
                  <span className={styles.testOk}>
                    <CheckCircle2 size={16} />
                    {existingInstallation?.installed ? (
                      <>
                        App already installed
                        {existingInstallation.accountLogin
                          ? ` on ${existingInstallation.accountLogin}`
                          : ""}
                        {existingInstallation.repository ? (
                          <>
                            {" "}
                            for <code>{existingInstallation.repository}</code>
                          </>
                        ) : null}
                      </>
                    ) : (
                      "GitHub App connected"
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={startGithubAppInstall}
                  >
                    <ExternalLink size={16} /> Reinstall
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={openInstallationSettings}
                  >
                    <ExternalLink size={16} /> Manage on GitHub
                  </Button>
                </div>
              ) : (
                !githubAppInstallPending && (
                  <div className={styles.githubAppStatus}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={startGithubAppInstall}
                      disabled={!githubAppConfigured}
                    >
                      <ExternalLink size={16} /> Install GitHub App
                    </Button>
                  </div>
                )
              )}

              {githubInstallNotice && (
                <p className={styles.formHint}>{githubInstallNotice}</p>
              )}
              {!githubAppConfigured && (
                <p className={styles.formHint}>
                  GitHub App credentials are incomplete on the server (private
                  key missing).
                </p>
              )}
              {!githubAppConnected &&
                fieldErrors?.providerGithubInstallationId && (
                  <p className={[styles.alert, styles.alertError].join(" ")}>
                    {fieldErrors.providerGithubInstallationId}
                  </p>
                )}
            </div>
          ) : (
            <Input
              label="Access token"
              type="password"
              value={values.providerToken}
              error={fieldErrors?.providerToken}
              onChange={(e) =>
                setField(
                  onChange,
                  onClearFieldError,
                  "providerToken",
                )(e.target.value)
              }
              placeholder={
                mode === "edit"
                  ? "Leave blank to keep current token"
                  : undefined
              }
              hint={
                <>
                  {mode === "edit" &&
                    "Only fill in to replace the stored token. "}
                  Use a dedicated bot account so issues show as ServiceBeard.{" "}
                  <DocsLink to={DOC_PATHS.github}>
                    How to create a GitHub token
                  </DocsLink>
                </>
              }
            />
          )}
        </>
      )}

      {providerSelected && isGitlab && (
        <>
          <RadioCardGroup
            name="providerHosting"
            label="Hosting"
            value={values.providerHosting}
            onChange={(hosting) =>
              patchForm(
                applyProviderHosting(values, hosting as ProviderHosting),
              )
            }
            options={GITLAB_HOSTING_OPTIONS}
          />

          {showGitlabBaseUrl && (
            <Input
              label="Instance URL"
              value={values.providerBaseUrl}
              error={fieldErrors?.providerBaseUrl}
              onChange={(e) =>
                setField(
                  onChange,
                  onClearFieldError,
                  "providerBaseUrl",
                )(e.target.value)
              }
              hint="Root URL of your GitLab instance, not the API endpoint."
            />
          )}

          {!isCreate || !values.providerProjectId.trim() ? (
            <Input
              label="Project"
              value={values.providerProjectId}
              error={fieldErrors?.providerProjectId}
              onChange={(e) =>
                setField(
                  onChange,
                  onClearFieldError,
                  "providerProjectId",
                )(e.target.value)
              }
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (!raw || !isCreate) return;
                const next = applyIssueRepositoryUrl(values, raw);
                patchForm({ providerProjectId: next.providerProjectId });
              }}
              hint="Paste a GitLab project URL or enter a numeric ID or group/project path."
            />
          ) : null}

          <Input
            label="Access token"
            type="password"
            value={values.providerToken}
            error={fieldErrors?.providerToken}
            onChange={(e) =>
              setField(
                onChange,
                onClearFieldError,
                "providerToken",
              )(e.target.value)
            }
            placeholder={
              mode === "edit" ? "Leave blank to keep current token" : undefined
            }
            hint={
              <>
                {mode === "edit" &&
                  "Only fill in to replace the stored token. "}
                Project access token recommended.{" "}
                <DocsLink to={DOC_PATHS.gitlab}>GitLab token guide</DocsLink>
              </>
            }
          />

          {showGitlabTls && (
            <>
              <Textarea
                label="Custom CA certificate (PEM, optional)"
                value={values.providerCaCert}
                error={fieldErrors?.providerCaCert}
                onChange={(e) =>
                  setField(
                    onChange,
                    onClearFieldError,
                    "providerCaCert",
                  )(e.target.value)
                }
                placeholder={
                  mode === "edit"
                    ? "Leave blank to keep current certificate. Paste a new PEM to replace."
                    : "-----BEGIN CERTIFICATE-----..."
                }
                hint="Preferred for self-signed certificates on your GitLab instance."
              />
              <Checkbox
                label="Skip TLS certificate verification"
                checked={values.providerTlsInsecure}
                onChange={(v) => onChange("providerTlsInsecure", v)}
                hint="Only if you cannot provide a custom CA certificate above."
              />
            </>
          )}
        </>
      )}

      {providerSelected && isLinear && (
        <>
          {!isCreate || !values.providerProjectId.trim() ? (
            <Input
              label="Team or project"
              value={values.providerProjectId}
              error={fieldErrors?.providerProjectId}
              onChange={(e) =>
                setField(
                  onChange,
                  onClearFieldError,
                  "providerProjectId",
                )(e.target.value)
              }
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (!raw) return;
                try {
                  patchForm({ providerProjectId: parseLinearTeam(raw) });
                } catch {
                  // Keep raw value for validation feedback.
                }
              }}
              hint="Paste a Linear team or project URL, or enter a team UUID/key (e.g. ENG)."
            />
          ) : null}

          <Input
            label="API key"
            type="password"
            value={values.providerToken}
            error={fieldErrors?.providerToken}
            onChange={(e) =>
              setField(
                onChange,
                onClearFieldError,
                "providerToken",
              )(e.target.value)
            }
            placeholder={
              mode === "edit" ? "Leave blank to keep current token" : undefined
            }
            hint={
              <>
                {mode === "edit" &&
                  "Only fill in to replace the stored token. "}
                Personal API key with Read, Create issues, Create comments, and
                Admin scopes.{" "}
                <DocsLink to={DOC_PATHS.linear}>Permission details</DocsLink>
              </>
            }
          />
        </>
      )}

      {providerSelected && (
        <div className={styles.testRow}>
          <Button
            type="button"
            variant="secondary"
            onClick={testProvider}
            disabled={!canTest || testState === "testing"}
          >
            {testState === "testing" ? (
              <>
                <Loader2 size={16} className={styles.spinIcon} /> Testing…
              </>
            ) : (
              "Test provider connection"
            )}
          </Button>
          {testState === "ok" && (
            <span className={styles.testOk}>
              <CheckCircle2 size={16} /> {testMessage}
            </span>
          )}
          {testState === "error" && (
            <span className={styles.testError}>
              <XCircle size={16} /> {testMessage}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectEditOptionsSection({ values, onChange }: SectionProps) {
  return (
    <div className={styles.formSection}>
      <h3 className={styles.sectionTitle}>Project options</h3>
      <Checkbox
        label="Project active"
        checked={values.isActive}
        onChange={(v) => onChange("isActive", v)}
      />
    </div>
  );
}
