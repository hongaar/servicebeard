import { ExtensionLoginFooter } from "@extensions";
import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  AuthDivider,
  AuthPageShell,
  EmailSignInButton,
  LoginEmailForm,
  PasskeyLoginButton,
  SignupLink,
  SsoLoginButton,
} from "../components/AuthForms";
import { useAuthEntry } from "../hooks/useAuthEntry";
import { isPasskeySupported } from "../lib/passkey";
import styles from "../styles/pages.module.css";

export function LoginPage() {
  const search = useSearch({ from: "/login" });
  const [emailExpanded, setEmailExpanded] = useState(false);
  const {
    loading,
    redirectingProvider,
    error,
    info,
    pendingVerificationEmail,
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

  return (
    <AuthPageShell>
      {hasSso && (
        <>
          {error && !emailExpanded && (
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
            {hasLocal && !emailExpanded && (
              <EmailSignInButton
                disabled={ssoBusy}
                onClick={() => {
                  setError("");
                  setEmailExpanded(true);
                }}
              />
            )}
          </div>

          {hasLocal && (
            <LoginEmailForm
              provider={localProvider!}
              loading={loading}
              expanded={emailExpanded}
              inset={emailExpanded}
              error={error}
              info={info}
              resendEmail={pendingVerificationEmail}
              onResendVerification={
                pendingVerificationEmail ? handleResendVerification : undefined
              }
              onSubmit={(credentials) =>
                handleCredentialLogin(localProvider!.type, credentials)
              }
            />
          )}

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
              <PasskeyLoginButton
                loading={loading}
                disabled={ssoBusy}
                onClick={() => handlePasskeyLogin("local")}
              />
            </div>
          )}
          <LoginEmailForm
            provider={localProvider}
            loading={loading}
            expanded
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
