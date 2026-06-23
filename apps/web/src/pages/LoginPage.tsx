import type { LoginProviderPublicConfig } from "@serviceboard/shared/login";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { api } from "../lib/api";
import { authenticateWithPasskey, isPasskeySupported, registerPasskey } from "../lib/passkey";
import styles from "../styles/pages.module.css";

function RedirectLoginButton({
  provider,
  loading,
  onStart,
}: {
  provider: LoginProviderPublicConfig;
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <Button onClick={onStart} disabled={loading}>
      {loading ? "Redirecting..." : provider.label}
    </Button>
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

      {provider.signupEnabled ? (
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
      ) : (
        <h2 className={styles.credentialAuthTitle}>Sign in</h2>
      )}

      {passkeySupported && mode === "login" && (
        <>
          <Button type="button" onClick={onPasskeyLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign in with passkey"}
          </Button>
          <div className={styles.divider}>
            <span>or</span>
          </div>
        </>
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
              <p className={styles.formHint}>Choose how to create your account:</p>
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
                  <Button type="submit" variant="secondary" disabled={loading}>
                    {loading ? "Creating account..." : "Create account with password"}
                  </Button>
                </form>
              ) : (
                <div className={styles.form}>
                  <p className={styles.formHint}>
                    No password needed — your device will create a passkey linked to this email.
                  </p>
                  <Button
                    type="button"
                    onClick={() => onPasskeySignup({ email, name })}
                    disabled={loading || !email || !name}
                  >
                    {loading ? "Creating account..." : "Create account with passkey"}
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
              <Button type="submit" variant="secondary" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
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
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<LoginProviderPublicConfig[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAuthConfig().then((config) => setProviders(config.providers));
  }, []);

  const handleRedirectLogin = (type: string) => {
    setLoading(true);
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

  const redirectProviders = providers.filter((provider) => provider.type === "oidc");
  const credentialProviders = providers.filter((provider) => provider.type === "local");

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Serviceboard</h1>
        <p className={styles.subtitle}>
          Sync your mailbox with issue boards. Sign in to get started.
        </p>

        {redirectProviders.map((provider) => (
          <RedirectLoginButton
            key={provider.type}
            provider={provider}
            loading={loading}
            onStart={() => handleRedirectLogin(provider.type)}
          />
        ))}

        {redirectProviders.length > 0 && credentialProviders.length > 0 && (
          <div className={styles.divider}>
            <span>or</span>
          </div>
        )}

        {credentialProviders.map((provider) => (
          <CredentialAuthForm
            key={provider.type}
            provider={provider}
            loading={loading}
            error={error}
            onSubmit={(credentials) =>
              handleCredentialLogin(provider.type, credentials)
            }
            onPasskeyLogin={() => handlePasskeyLogin(provider.type)}
            onPasskeySignup={(input) => handlePasskeySignup(provider.type, input)}
          />
        ))}
      </div>
    </div>
  );
}
