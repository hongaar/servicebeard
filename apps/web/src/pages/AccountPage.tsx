import type { LoginProviderType } from "@servicebeard/shared/login";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
import { Github, Gitlab, KeyRound, Link2, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import { handleMutationError } from "../lib/formErrors";
import { iconSm } from "../lib/icons";
import styles from "../styles/pages.module.css";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  email_taken:
    "An account with this email already exists. Sign in with your existing method, then link this provider here.",
  provider_already_linked: "This provider is already linked to an account.",
  link_session_expired:
    "Your session expired during linking. Sign in and try again.",
  last_auth_method: "Cannot remove your only sign-in method.",
  provider_not_linked: "This provider is not linked to your account.",
  login_failed: "Sign-in failed. Please try again.",
  oauth_cancelled: "Provider linking was cancelled. Please try again.",
};

function ProviderIcon({ type }: { type: LoginProviderType }) {
  const props = { ...iconSm, className: styles.accountProviderIcon };
  switch (type) {
    case "github":
      return <Github {...props} />;
    case "gitlab":
      return <Gitlab {...props} />;
    case "linear":
      return (
        <>
          <img
            src="/linear-icon.svg"
            alt=""
            className={`${styles.accountProviderIcon} ${styles.accountProviderLinearLight}`}
          />
          <img
            src="/linear-icon-white.svg"
            alt=""
            className={`${styles.accountProviderIcon} ${styles.accountProviderLinearDark}`}
          />
        </>
      );
    case "oidc":
      return <KeyRound {...props} />;
    default:
      return <KeyRound {...props} />;
  }
}

function providerLabel(type: LoginProviderType): string {
  switch (type) {
    case "github":
      return "GitHub";
    case "gitlab":
      return "GitLab";
    case "linear":
      return "Linear";
    case "oidc":
      return "SSO";
    default:
      return type;
  }
}

export function AccountPage() {
  const { user } = useLoaderData({ from: "/account" }) as {
    user: { email: string; name: string | null; isAdmin: boolean };
  };
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [unlinkingProvider, setUnlinkingProvider] =
    useState<LoginProviderType | null>(null);

  const { data: account, isLoading } = useQuery({
    queryKey: ["account"],
    queryFn: () => api.getAccount(),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const error = params.get("error");

    if (linked) {
      setMessage(
        `${providerLabel(linked as LoginProviderType)} linked successfully.`,
      );
      setIsError(false);
      void queryClient.invalidateQueries({ queryKey: ["account"] });
      window.history.replaceState({}, "", "/account");
    } else if (error) {
      setMessage(AUTH_ERROR_MESSAGES[error] ?? "Something went wrong.");
      setIsError(true);
      window.history.replaceState({}, "", "/account");
    }
  }, [queryClient]);

  const unlink = useMutation({
    mutationFn: (provider: LoginProviderType) => api.unlinkProvider(provider),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      setMessage("Provider unlinked.");
      setIsError(false);
      setUnlinkingProvider(null);
    },
    onError: (err) => {
      handleMutationError(err, setMessage, () => {});
      setIsError(true);
      setUnlinkingProvider(null);
    },
  });

  const handleLink = (provider: LoginProviderType) => {
    window.location.href = `/api/auth/link/${provider}`;
  };

  const linkedByType = new Map(
    (account?.linkedProviders ?? []).map((row) => [row.provider, row]),
  );

  return (
    <Layout
      title="Account"
      description="Manage your profile and connected sign-in providers."
      user={user}
    >
      {message && (
        <div
          className={[
            styles.alert,
            isError ? styles.alertError : styles.alertSuccess,
          ].join(" ")}
        >
          {message}
        </div>
      )}

      <Card title="Profile" subtitle="Your account details">
        <dl className={styles.accountProfileList}>
          <div>
            <dt>Name</dt>
            <dd>{user.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Connected accounts"
        subtitle="Link OAuth providers to sign in with GitHub, GitLab, or SSO. Linking requires an active session — providers are never linked automatically during sign-up."
      >
        {isLoading ? (
          <p className={styles.accountHint}>Loading…</p>
        ) : (
          <ul className={styles.accountProviderList}>
            {(account?.availableProviders ?? []).map((provider) => {
              const linked = linkedByType.get(provider.type);
              return (
                <li key={provider.type} className={styles.accountProviderRow}>
                  <div className={styles.accountProviderInfo}>
                    <ProviderIcon type={provider.type} />
                    <div>
                      <p className={styles.accountProviderName}>
                        {provider.label}
                      </p>
                      <p className={styles.accountProviderMeta}>
                        {linked
                          ? `Linked ${new Date(linked.linkedAt).toLocaleDateString()}`
                          : "Not linked"}
                      </p>
                    </div>
                  </div>
                  {linked ? (
                    <Button
                      variant="ghost"
                      size="small"
                      disabled={!linked.canUnlink || unlink.isPending}
                      onClick={() => {
                        setUnlinkingProvider(provider.type);
                        unlink.mutate(provider.type);
                      }}
                    >
                      <Unlink {...iconSm} />
                      {unlinkingProvider === provider.type && unlink.isPending
                        ? "Unlinking…"
                        : "Unlink"}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleLink(provider.type)}
                    >
                      <Link2 {...iconSm} />
                      Link
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {account?.hasLocalSignIn && (
          <p className={styles.accountHint}>
            Local sign-in (email, password, or passkey) is always available for
            this account.
          </p>
        )}
      </Card>
    </Layout>
  );
}
