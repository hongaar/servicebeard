import type {
  LoginProviderPublicConfig,
  LoginProviderType,
} from "@servicebeard/shared/login";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  Fingerprint,
  Github,
  Gitlab,
  KeyRound,
  Lock,
  LogIn,
  Mail,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api, ApiError } from "../lib/api";
import { ssoIconProps as baseSsoIconProps, iconMd, iconSm } from "../lib/icons";
import {
  authenticateWithPasskey,
  isPasskeySupported,
  registerPasskey,
} from "../lib/passkey";
import { normalizeRedirectPath } from "../lib/redirect";
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

function PasskeyLoginButton({
  loading,
  disabled,
  onClick,
  label = "Sign in with passkey",
  loadingLabel = "Signing in…",
}: {
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  loadingLabel?: string;
}) {
  return (
    <button
      type="button"
      className={[styles.ssoButton, styles.ssoButton_passkey].join(" ")}
      onClick={onClick}
      disabled={disabled || loading}
    >
      <Fingerprint {...ssoIconProps} />
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
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
  info,
  onResendVerification,
  resendEmail,
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
  info?: string;
  onResendVerification?: () => void;
  resendEmail?: string;
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
      {(error || info || (onResendVerification && resendEmail)) && (
        <div className={styles.credentialAuthMessages}>
          {error && (
            <div className={[styles.alert, styles.alertError].join(" ")}>
              {error}
            </div>
          )}
          {info && (
            <div className={[styles.alert, styles.alertSuccess].join(" ")}>
              {info}
            </div>
          )}
          {onResendVerification && resendEmail && (
            <p className={styles.formHint}>
              Didn&apos;t get the email?{" "}
              <button
                type="button"
                className={styles.inlineTextButton}
                onClick={onResendVerification}
              >
                Resend confirmation
              </button>
            </p>
          )}
        </div>
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
                  <Lock {...iconSm} />
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
                  <Fingerprint {...iconSm} />
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
                  <Button
                    type="submit"
                    disabled={loading}
                    className={styles.fullWidth}
                  >
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              ) : (
                <div className={styles.form}>
                  <p className={styles.formHint}>
                    Your device will create a passkey linked to this email — no
                    password needed.
                  </p>
                  <Button
                    type="button"
                    onClick={() => onPasskeySignup({ email, name })}
                    disabled={loading || !email || !name}
                    className={styles.fullWidth}
                  >
                    <Fingerprint {...iconMd} />
                    {loading
                      ? "Creating account…"
                      : "Create account with passkey"}
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
              <Button
                type="submit"
                disabled={loading}
                className={styles.fullWidth}
              >
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
            <LogIn {...iconMd} />
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className={styles.formHint}>
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          {passkeySupported && (
            <PasskeyLoginButton loading={loading} onClick={onPasskeyLogin} />
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
  const search = useSearch({ from: "/login" });
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] =
    useState<LoginProviderType | null>(null);
  const [providers, setProviders] = useState<LoginProviderPublicConfig[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const redirectAfterLogin = () => {
    const path = normalizeRedirectPath(search.redirect);
    if (path) {
      window.location.href = path;
      return;
    }
    navigate({ to: "/" });
  };

  useEffect(() => {
    api.getAuthConfig().then((config) => {
      setProviders(config.providers);
      const hasSso = config.providers.some(
        (provider) => provider.type !== "local",
      );
      setShowEmailLogin(!hasSso);
    });

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error") ?? search.error;
    if (authError === "email_taken") {
      setError(
        "An account with this email already exists. Sign in with your existing method, then link this provider from Account settings.",
      );
      window.history.replaceState({}, "", "/login");
    } else if (authError === "login_failed") {
      setError("Login failed. Please try again.");
      window.history.replaceState({}, "", "/login");
    } else if (authError) {
      setError("Sign-in failed. Please try again.");
      window.history.replaceState({}, "", "/login");
    }
  }, [search.error]);

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.resendVerification(pendingVerificationEmail);
      setInfo(result.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not resend verification email",
      );
    } finally {
      setLoading(false);
    }
  };

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
    setInfo("");
    setPendingVerificationEmail("");
    try {
      const result = await api.loginWithProvider(type, credentials);
      if ("requiresVerification" in result && result.requiresVerification) {
        setInfo(result.message);
        setPendingVerificationEmail(credentials.email);
        setLoading(false);
        return;
      }
      redirectAfterLogin();
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_not_verified") {
        setPendingVerificationEmail(credentials.email);
      }
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async (type: string) => {
    setLoading(true);
    setError("");
    try {
      await authenticateWithPasskey(type);
      redirectAfterLogin();
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
    setInfo("");
    setPendingVerificationEmail("");
    try {
      const result = await registerPasskey(type, input);
      if ("requiresVerification" in result && result.requiresVerification) {
        setInfo(result.message);
        setPendingVerificationEmail(input.email);
        setLoading(false);
        return;
      }
      redirectAfterLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-up failed");
      setLoading(false);
    }
  };

  const redirectProviders = providers.filter(
    (provider) => provider.type !== "local",
  );
  const credentialProviders = providers.filter(
    (provider) => provider.type === "local",
  );
  const localProvider = credentialProviders[0];
  const hasSso = redirectProviders.length > 0;
  const hasLocal = credentialProviders.length > 0;
  const passkeyQuickLogin =
    hasLocal && localProvider?.passkeyEnabled && isPasskeySupported();
  const ssoBusy = redirectingProvider !== null || loading;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img
          src="/favicon.png"
          alt=""
          className={styles.loginLogo}
          width={56}
          height={56}
        />
        <h1 className={styles.title}>
          Service<span className={styles.titleAccent}>Beard</span>
        </h1>
        <p className={styles.subtitle}>
          Turn support mailboxes into issue boards.
        </p>

        {hasSso && !showEmailLogin && (
          <>
            {error && (
              <div className={[styles.alert, styles.alertError].join(" ")}>
                {error}
              </div>
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
                <PasskeyLoginButton
                  loading={loading}
                  disabled={ssoBusy}
                  onClick={() => handlePasskeyLogin("local")}
                />
              )}
              {hasLocal && (
                <button
                  type="button"
                  className={[styles.ssoButton, styles.ssoButton_email].join(
                    " ",
                  )}
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

        {hasLocal &&
          showEmailLogin &&
          credentialProviders.map((provider) => (
            <CredentialAuthForm
              key={provider.type}
              provider={provider}
              loading={loading}
              error={error}
              info={info}
              resendEmail={pendingVerificationEmail}
              onResendVerification={
                pendingVerificationEmail ? handleResendVerification : undefined
              }
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
              onPasskeySignup={(input) =>
                handlePasskeySignup(provider.type, input)
              }
            />
          ))}
      </div>
    </div>
  );
}
