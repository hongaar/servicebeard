import type { LoginProviderType } from "@servicebeard/shared/login";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import {
  getLastUsedSignInMethod,
  setLastUsedSignInMethod,
} from "../lib/lastSignInMethod";
import { authenticateWithPasskey, registerPasskey } from "../lib/passkey";
import { normalizeRedirectPath } from "../lib/redirect";

export function useAuthEntry(search: { redirect?: string; error?: string }) {
  const navigate = useNavigate();
  const { data: authConfig, isPending: configLoading } = useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api.getAuthConfig(),
    staleTime: 60_000,
  });
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] =
    useState<LoginProviderType | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [lastUsedSignInMethod] = useState(() => getLastUsedSignInMethod());

  const providers = authConfig?.providers ?? [];
  const configLoaded = !configLoading;

  const redirectAfterAuth = () => {
    const path = normalizeRedirectPath(search.redirect);
    if (path) {
      window.location.href = path;
      return;
    }
    navigate({ to: "/" });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error") ?? search.error;
    if (authError === "email_taken") {
      setError(
        "An account with this email already exists. Sign in with your existing method, then link this provider from Account settings.",
      );
      window.history.replaceState({}, "", window.location.pathname);
    } else if (authError === "login_failed") {
      setError("Login failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (authError) {
      setError("Sign-in failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
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
    setLastUsedSignInMethod(type);
    setRedirectingProvider(type);
    window.location.href = `/api/auth/login/${type}`;
  };

  const handleCredentialLogin = async (
    type: string,
    credentials: { email: string; password: string },
  ) => {
    setLoading(true);
    setError("");
    setInfo("");
    setPendingVerificationEmail("");
    setLastUsedSignInMethod("email");
    try {
      const result = await api.loginWithProvider(type, {
        ...credentials,
        mode: "login",
      });
      if ("requiresVerification" in result && result.requiresVerification) {
        setInfo(result.message);
        setPendingVerificationEmail(credentials.email);
        setLoading(false);
        return;
      }
      redirectAfterAuth();
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_not_verified") {
        setPendingVerificationEmail(credentials.email);
      }
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  const handleCredentialSignup = async (
    type: string,
    credentials: { email: string; password: string; name: string },
  ) => {
    setLastUsedSignInMethod("email");
    setLoading(true);
    setError("");
    setInfo("");
    setPendingVerificationEmail("");
    try {
      const result = await api.loginWithProvider(type, {
        ...credentials,
        mode: "signup",
      });
      if ("requiresVerification" in result && result.requiresVerification) {
        setInfo(result.message);
        setPendingVerificationEmail(credentials.email);
        setLoading(false);
        return;
      }
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async (type: string) => {
    setLastUsedSignInMethod("passkey");
    setLoading(true);
    setError("");
    try {
      await authenticateWithPasskey(type);
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-in failed");
      setLoading(false);
    }
  };

  const handlePasskeySignup = async (
    type: string,
    input: { email: string; name: string },
  ) => {
    setLastUsedSignInMethod("passkey");
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
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Passkey sign-up failed");
      setLoading(false);
    }
  };

  const redirectProviders = providers.filter(
    (provider) => provider.type !== "local",
  );
  const localProvider = providers.find((provider) => provider.type === "local");
  const hasSso = redirectProviders.length > 0;
  const hasLocal = Boolean(localProvider);
  const signupAvailable = providers.some((provider) => provider.signupEnabled);
  const ssoBusy = redirectingProvider !== null || loading;

  return {
    configLoaded,
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
    handleCredentialSignup,
    handlePasskeyLogin,
    handlePasskeySignup,
  };
}
