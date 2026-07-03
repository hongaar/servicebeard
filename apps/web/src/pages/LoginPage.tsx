import { ExtensionLoginFooter } from "@extensions";
import type { LoginProviderPublicConfig } from "@servicebeard/shared/login";
import { useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AuthDivider,
  AuthPageShell,
  EmailSignInButton,
  LoginEmailForm,
  PasskeyLoginButton,
  SignInOptionShell,
  SignupLink,
  SsoLoginButton,
} from "../components/AuthForms";
import { useAuthEntry } from "../hooks/useAuthEntry";
import {
  getLastUsedSignInMethod,
  moveLastUsedSignInMethodToFront,
  setLastUsedSignInMethod,
  type SignInMethod,
} from "../lib/lastSignInMethod";
import { isPasskeySupported } from "../lib/passkey";
import styles from "../styles/pages.module.css";

type SignInOption =
  | {
      method: SignInMethod;
      kind: "sso";
      provider: LoginProviderPublicConfig;
    }
  | { method: "passkey"; kind: "passkey" }
  | { method: "email"; kind: "email" };

export function LoginPage() {
  const search = useSearch({ from: "/login" });
  const emailWasLastUsed = getLastUsedSignInMethod() === "email";
  const [emailExpanded, setEmailExpanded] = useState(() => emailWasLastUsed);
  const [emailAtTop, setEmailAtTop] = useState(() => emailWasLastUsed);
  const {
    loading,
    redirectingProvider,
    error,
    info,
    pendingVerificationEmail,
    lastUsedSignInMethod,
    redirectProviders,
    localProvider,
    hasSso,
    hasLocal,
    signupAvailable,
    ssoBusy,
    setError,
    handleResendVerification,
    handleRedirectLogin,
    handleCredentialLogin,
    handlePasskeyLogin,
  } = useAuthEntry(search);

  const passkeyQuickLogin =
    hasLocal && localProvider?.passkeyEnabled && isPasskeySupported();

  const signInOptions = useMemo(() => {
    const options: SignInOption[] = redirectProviders.map((provider) => ({
      method: provider.type,
      kind: "sso",
      provider,
    }));
    if (passkeyQuickLogin) {
      options.push({ method: "passkey", kind: "passkey" });
    }
    if (hasLocal && !emailExpanded) {
      options.push({ method: "email", kind: "email" });
    }
    return moveLastUsedSignInMethodToFront(options, lastUsedSignInMethod);
  }, [
    redirectProviders,
    passkeyQuickLogin,
    hasLocal,
    emailExpanded,
    lastUsedSignInMethod,
  ]);

  const renderSignInOption = (option: SignInOption) => {
    const lastUsed = lastUsedSignInMethod === option.method;

    switch (option.kind) {
      case "sso":
        return (
          <SignInOptionShell key={option.provider.type} lastUsed={lastUsed}>
            <SsoLoginButton
              provider={option.provider}
              redirectingProvider={redirectingProvider}
              disabled={loading}
              onStart={() => handleRedirectLogin(option.provider.type)}
            />
          </SignInOptionShell>
        );
      case "passkey":
        return (
          <SignInOptionShell key="passkey" lastUsed={lastUsed}>
            <PasskeyLoginButton
              loading={loading}
              disabled={ssoBusy}
              onClick={() => handlePasskeyLogin("local")}
            />
          </SignInOptionShell>
        );
      case "email":
        return (
          <SignInOptionShell key="email" lastUsed={lastUsed}>
            <EmailSignInButton
              disabled={ssoBusy}
              onClick={() => {
                setLastUsedSignInMethod("email");
                setError("");
                setEmailAtTop(false);
                setEmailExpanded(true);
              }}
            />
          </SignInOptionShell>
        );
    }
  };

  const emailFormLastUsed = lastUsedSignInMethod === "email";

  const loginEmailForm =
    hasLocal && localProvider ? (
      <LoginEmailForm
        provider={localProvider}
        loading={loading}
        expanded={emailExpanded}
        inset={emailExpanded && !emailAtTop}
        lastUsed={emailFormLastUsed}
        error={error}
        info={info}
        resendEmail={pendingVerificationEmail}
        onResendVerification={
          pendingVerificationEmail ? handleResendVerification : undefined
        }
        onSubmit={(credentials) =>
          handleCredentialLogin(localProvider.type, credentials)
        }
      />
    ) : null;

  return (
    <AuthPageShell subtitle="Login to your account">
      {hasSso && (
        <>
          {error && !emailExpanded && (
            <div className={[styles.alert, styles.alertError].join(" ")}>
              {error}
            </div>
          )}

          {emailExpanded && emailAtTop && loginEmailForm && (
            <div className={styles.signInPrimary}>{loginEmailForm}</div>
          )}

          <div className={styles.ssoList}>
            {signInOptions.map(renderSignInOption)}
          </div>

          {emailExpanded && !emailAtTop && loginEmailForm}

          {signupAvailable && (
            <>
              <AuthDivider />
              <SignupLink
                search={
                  search.redirect ? { redirect: search.redirect } : undefined
                }
              />
            </>
          )}
        </>
      )}

      {!hasSso && hasLocal && localProvider && (
        <>
          {passkeyQuickLogin && (
            <div className={styles.ssoList}>
              <SignInOptionShell lastUsed={lastUsedSignInMethod === "passkey"}>
                <PasskeyLoginButton
                  loading={loading}
                  disabled={ssoBusy}
                  onClick={() => handlePasskeyLogin("local")}
                />
              </SignInOptionShell>
            </div>
          )}
          <LoginEmailForm
            provider={localProvider}
            loading={loading}
            expanded
            lastUsed={emailFormLastUsed}
            error={error}
            info={info}
            resendEmail={pendingVerificationEmail}
            onResendVerification={
              pendingVerificationEmail ? handleResendVerification : undefined
            }
            onSubmit={(credentials) =>
              handleCredentialLogin(localProvider.type, credentials)
            }
          />
        </>
      )}

      {!hasSso &&
        hasLocal &&
        signupAvailable &&
        localProvider?.signupEnabled && (
          <>
            <AuthDivider />
            <SignupLink
              search={
                search.redirect ? { redirect: search.redirect } : undefined
              }
            />
          </>
        )}

      {ExtensionLoginFooter && <ExtensionLoginFooter />}
    </AuthPageShell>
  );
}
