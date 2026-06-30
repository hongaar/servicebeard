import type {
  LoginProviderPublicConfig,
  LoginProviderType,
} from "@servicebeard/shared/login";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Fingerprint,
  Github,
  Gitlab,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ssoIconProps as baseSsoIconProps, iconMd, iconSm } from "../lib/icons";
import { isPasskeySupported } from "../lib/passkey";
import styles from "../styles/pages.module.css";
import { Button } from "./Button";
import { Input } from "./Input";

export const ssoIconProps = {
  ...baseSsoIconProps,
  className: styles.ssoButtonIcon,
};

export function SsoIcon({ type }: { type: LoginProviderType }) {
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

export function PasskeyLoginButton({
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

export function SsoLoginButton({
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

export function AuthPageShell({ children }: { children?: ReactNode }) {
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
        <p className={styles.subtitle}>Turn mailboxes into issue boards.</p>
        {children}
      </div>
    </div>
  );
}

export function AuthMessages({
  error,
  info,
  onResendVerification,
  resendEmail,
}: {
  error?: string;
  info?: string;
  onResendVerification?: () => void;
  resendEmail?: string;
}) {
  if (!error && !info && !(onResendVerification && resendEmail)) {
    return null;
  }

  return (
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
  );
}

type SignupMethod = "password" | "passkey";

export function LoginEmailForm({
  provider,
  loading,
  expanded,
  inset,
  onSubmit,
  error,
  info,
  onResendVerification,
  resendEmail,
}: {
  provider: LoginProviderPublicConfig;
  loading: boolean;
  expanded: boolean;
  inset?: boolean;
  onSubmit: (credentials: { email: string; password: string }) => void;
  error?: string;
  info?: string;
  onResendVerification?: () => void;
  resendEmail?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (provider.defaults) {
      setEmail(provider.defaults.email);
      if (provider.defaults.password) {
        setPassword(provider.defaults.password);
      }
    }
  }, [provider.defaults]);

  if (!expanded) {
    return null;
  }

  return (
    <div
      className={[
        styles.credentialAuth,
        inset ? styles.credentialAuthInset : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AuthMessages
        error={error}
        info={info}
        onResendVerification={onResendVerification}
        resendEmail={resendEmail}
      />

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ email, password });
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
      </form>
    </div>
  );
}

export function SignupEmailForm({
  provider,
  loading,
  onSubmit,
  onPasskeySignup,
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
    name: string;
  }) => void;
  onPasskeySignup: (input: { email: string; name: string }) => void;
  error?: string;
  info?: string;
  onResendVerification?: () => void;
  resendEmail?: string;
}) {
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
    onSubmit({ email, password, name });
  };

  return (
    <div className={styles.credentialAuth}>
      <AuthMessages
        error={error}
        info={info}
        onResendVerification={onResendVerification}
        resendEmail={resendEmail}
      />

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
    </div>
  );
}

export function EmailSignInButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[styles.ssoButton, styles.ssoButton_email].join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      <Mail {...ssoIconProps} />
      <span>Sign in with email</span>
    </button>
  );
}

export function SignupLink({ search }: { search?: { redirect?: string } }) {
  return (
    <Link
      to="/signup"
      search={search}
      className={[styles.ssoButton, styles.ssoButton_back].join(" ")}
    >
      <UserPlus {...ssoIconProps} />
      <span>Sign up</span>
    </Link>
  );
}

export function SignInLink({ search }: { search?: { redirect?: string } }) {
  return (
    <Link
      to="/login"
      search={search}
      className={[styles.ssoButton, styles.ssoButton_back].join(" ")}
    >
      <ArrowLeft {...ssoIconProps} />
      <span>Back to sign in</span>
    </Link>
  );
}

export function AuthDivider() {
  return <div className={styles.divider}>or</div>;
}
