import type { LoginProviderPublicConfig, LoginProviderType } from "@servicebeard/shared/login";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Fingerprint,
  Github,
  Gitlab,
  KeyRound,
  Mail,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../lib/api";
import { ssoIconProps as baseSsoIconProps } from "../lib/icons";
import { authenticateWithPasskey, isPasskeySupported, registerPasskey } from "../lib/passkey";
import styles from "../styles/pages.module.css";

const ssoIconProps = { ...baseSsoIconProps, className: styles.ssoButtonIcon };

function SsoIcon({ type }: { type: LoginProviderType }) {
  switch (type) {
    case "github":
      return <Github {...ssoIconProps} />;
    case "gitlab":
      return <Gitlab {...ssoIconProps} />;
    case "oidc":
      return <KeyRound {...ssoIconProps} />;
    default:
      return <KeyRound {...ssoIconProps} />;
  }
}

function SsoLoginButton({
  provider,
  redirectingProvider,
  disabled,
  onStart,
}: {
  provider: LoginProviderPublicConfig;
  redirectingProvider: LoginProviderType | null;
  disabled?: boolean;
  onStart: () => void;
}) {
  const isRedirecting = redirectingProvider === provider.type;
  const isDisabled = disabled || redirectingProvider !== null;

  return (
    <button
      type="button"
      className={[styles.ssoButton, styles[`ssoButton_${provider.type}`]]
        .filter(Boolean)
        .join(" ")}
      onClick={onStart}
      disabled={isDisabled}
    >
      <SsoIcon type={provider.type} />
      <span>{isRedirecting ? "Redirecting…" : provider.label}</span>
    </button>
  );
}

type CredentialMode = "login" | "signup";
type SignupMethod = "password" | "passkey";

function CredentialAuthForm({
  provider,
  loading,
  onSubmit,
  onPasskeyLogin,
  onPasskeySignup,
  onBack,
  error,
}: {
  provider: LoginProviderPublicConfig;
  loading: boolean;
  onSubmit: (credentials: {
    email: string;
    password: string;
    name?: string;
    mode: CredentialMode;
  }) => void;
  onPasskeyLogin: () => void;
  onPasskeySignup: (input: { email: string; name: string }) => void;
  onBack?: () => void;
  error: string;
}) {
  const [mode, setMode] = useState<CredentialMode>("login");
  const [signupMethod, setSignupMethod] = useState<SignupMethod>("password");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const passkeySupported = provider.passkeyEnabled && isPasskeySupported();

  useEffect(() => {
    if (provider.defaults) {
      setEmail(provider.defaults.email);
      setName(provider.defaults.name);
      if (provider.defaults.password) {
        setPassword(provider.defaults.password);
      }
    }
  }, [provider.defaults]);

  const handleSubmit = () => {
    onSubmit({
      email,
      password,
      name: mode === "signup" ? name : undefined,
      mode,
    });
  };

  return (
    <div className={styles.credentialAuth}>
      {error && (
        <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>
      )}

      {provider.signupEnabled && (
        <div className={styles.tabs}>
          <button
            type="button"
            className={[styles.tab, mode === "login" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={[styles.tab, mode === "signup" ? styles.tabActive : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>
      )}

      {mode === "signup" && provider.signupEnabled ? (
        <div className={styles.form}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {passkeySupported ? (
            <>
              <div className={styles.methodTabs}>
                <button
                  type="button"
                  className={[
                    styles.methodTab,
                    signupMethod === "password" ? styles.methodTabActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSignupMethod("password")}
                >
                  Password
                </button>
                <button
                  type="button"
                  className={[
                    styles.methodTab,
                    signupMethod === "passkey" ? styles.methodTabActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSignupMethod("passkey")}
                >
                  Passkey
                </button>
              </div>

              {signupMethod === "password" ? (
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                >
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <Button type="submit" disabled={loading} className={styles.fullWidth}>
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              ) : (
                <div className={styles.form}>
                  <p className={styles.formHint}>
                    Your device will create a passkey linked to this email — no password needed.
                  </p>
                  <Button
                    type="button"
                    onClick={() => onPasskeySignup({ email, name })}
                    disabled={loading || !email || !name}
                    className={styles.fullWidth}
                  >
                    {loading ? "Creating account…" : "Create account with passkey"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Button type="submit" disabled={loading} className={styles.fullWidth}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" disabled={loading} className={styles.fullWidth}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          {passkeySupported && (
            <button
              type="button"
              className={styles.passkeyLink}
              onClick={onPasskeyLogin}
              disabled={loading}
            >
              Sign in with passkey
            </button>
          )}
        </form>
      )}

      {onBack && (
        <button
          type="button"
          className={[styles.ssoButton, styles.ssoButton_back].join(" ")}
          onClick={onBack}
          disabled={loading}
        >
          <ArrowLeft {...ssoIconProps} />
          <span>Back to other sign-in options</span>
        </button>
      )}
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] =
    useState<LoginProviderType | null>(null);
  const [providers, setProviders] = useState<LoginProviderPublicConfig[]>([]);
  const [error, setError] = useState("");
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  useEffect(() => {
    api.getAuthConfig().then((config) => {
      setProviders(config.providers);
      const hasSso = config.providers.some((provider) => provider.type !== "local");
      setShowEmailLogin(!hasSso);
    });
  }, []);

  const handleRedirectLogin = (type: LoginProviderType) => {
    setRedirectingProvider(type);
    window.location.href = `/api/auth/login/${type}`;
  };

  const handleCredentialLogin = async (
    type: string,
    credentials: {
      email: string;
      password: string;
      name?: string;
      mode: CredentialMode;
    },
  ) => {
    setLoading(true);
    setError("");
    try {
      await api.loginWithProvider(type, credentials);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async (type: string) => {
    setLoading(true);
    setError("");
    try {
      await authenticateWithPasskey(type);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in failed");
      setLoading(false);
    }
  };

  const handlePasskeySignup = async (
    type: string,
    input: { email: string; name: string },
  ) => {
    setLoading(true);
    setError("");
    try {
      await registerPasskey(type, input);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-up failed");
      setLoading(false);
    }
  };

  const redirectProviders = providers.filter((provider) => provider.type !== "local");
  const credentialProviders = providers.filter((provider) => provider.type === "local");
  const localProvider = credentialProviders[0];
  const hasSso = redirectProviders.length > 0;
  const hasLocal = credentialProviders.length > 0;
  const passkeyQuickLogin =
    hasLocal &&
    localProvider?.passkeyEnabled &&
    isPasskeySupported();
  const ssoBusy = redirectingProvider !== null || loading;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/favicon.png" alt="" className={styles.loginLogo} width={56} height={56} />
        <h1 className={styles.title}>
          Service<span className={styles.titleAccent}>Beard</span>
        </h1>
        <p className={styles.subtitle}>
          Turn support mailboxes into issue boards.
        </p>

        {hasSso && !showEmailLogin && (
          <>
            {error && (
              <div className={[styles.alert, styles.alertError].join(" ")}>{error}</div>
            )}
            <div className={styles.ssoList}>
              {redirectProviders.map((provider) => (
                <SsoLoginButton
                  key={provider.type}
                  provider={provider}
                  redirectingProvider={redirectingProvider}
                  disabled={loading}
                  onStart={() => handleRedirectLogin(provider.type)}
                />
              ))}
              {passkeyQuickLogin && (
                <button
                  type="button"
                  className={[styles.ssoButton, styles.ssoButton_passkey].join(" ")}
                  onClick={() => handlePasskeyLogin("local")}
                  disabled={ssoBusy}
                >
                  <Fingerprint {...ssoIconProps} />
                  <span>{loading ? "Signing in…" : "Sign in with passkey"}</span>
                </button>
              )}
              {hasLocal && (
                <button
                  type="button"
                  className={[styles.ssoButton, styles.ssoButton_email].join(" ")}
                  onClick={() => {
                    setError("");
                    setShowEmailLogin(true);
                  }}
                  disabled={ssoBusy}
                >
                  <Mail {...ssoIconProps} />
                  <span>Sign in with email</span>
                </button>
              )}
            </div>
          </>
        )}

        {hasLocal && showEmailLogin && (
          credentialProviders.map((provider) => (
            <CredentialAuthForm
              key={provider.type}
              provider={provider}
              loading={loading}
              error={error}
              onBack={
                hasSso
                  ? () => {
                      setError("");
                      setShowEmailLogin(false);
                    }
                  : undefined
              }
              onSubmit={(credentials) =>
                handleCredentialLogin(provider.type, credentials)
              }
              onPasskeyLogin={() => handlePasskeyLogin(provider.type)}
              onPasskeySignup={(input) => handlePasskeySignup(provider.type, input)}
            />
          ))
        )}
      </div>
    </div>
  );
}
