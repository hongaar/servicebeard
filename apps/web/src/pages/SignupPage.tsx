import { ExtensionLoginFooter } from "@extensions";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  AuthDivider,
  AuthPageShell,
  SignupEmailForm,
  SsoLoginButton,
} from "../components/AuthForms";
import { useAuthEntry } from "../hooks/useAuthEntry";
import styles from "../styles/pages.module.css";

export function SignupPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/signup" });
  const {
    configLoaded,
    loading,
    redirectingProvider,
    error,
    info,
    pendingVerificationEmail,
    redirectProviders,
    localProvider,
    signupAvailable,
    handleResendVerification,
    handleRedirectLogin,
    handleCredentialSignup,
    handlePasskeySignup,
  } = useAuthEntry(search);

  const signupProviders = redirectProviders.filter(
    (provider) => provider.signupEnabled,
  );
  const hasSsoSignup = signupProviders.length > 0;
  const hasLocalSignup = Boolean(localProvider?.signupEnabled);

  useEffect(() => {
    if (configLoaded && !signupAvailable) {
      navigate({
        to: "/login",
        search: search.redirect ? { redirect: search.redirect } : undefined,
        replace: true,
      });
    }
  }, [configLoaded, navigate, search.redirect, signupAvailable]);

  if (!configLoaded) {
    return <AuthPageShell />;
  }

  if (!signupAvailable) {
    return null;
  }

  return (
    <AuthPageShell>
      {hasSsoSignup && (
        <>
          {error && !hasLocalSignup && (
            <div className={[styles.alert, styles.alertError].join(" ")}>
              {error}
            </div>
          )}
          <div className={styles.ssoList}>
            {signupProviders.map((provider) => (
              <SsoLoginButton
                key={provider.type}
                provider={provider}
                redirectingProvider={redirectingProvider}
                disabled={loading}
                onStart={() => handleRedirectLogin(provider.type)}
              />
            ))}
          </div>
        </>
      )}

      {hasSsoSignup && hasLocalSignup && <AuthDivider />}

      {hasLocalSignup && localProvider && (
        <SignupEmailForm
          provider={localProvider}
          loading={loading}
          error={error}
          info={info}
          resendEmail={pendingVerificationEmail}
          onResendVerification={
            pendingVerificationEmail ? handleResendVerification : undefined
          }
          onSubmit={(credentials) =>
            handleCredentialSignup(localProvider.type, credentials)
          }
          onPasskeySignup={(input) =>
            handlePasskeySignup(localProvider.type, input)
          }
        />
      )}

      {ExtensionLoginFooter && <ExtensionLoginFooter />}
    </AuthPageShell>
  );
}
