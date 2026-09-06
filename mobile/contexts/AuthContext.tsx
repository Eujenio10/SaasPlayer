import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { deriveUserAccessStatus } from "@/lib/access/user-status";
import type { SubscriptionEntitlement, UserAccessStatus } from "@/lib/access/types";
import { ensureWebAuthRedirect, passwordResetRedirectUrl, signupEmailRedirectUrl } from "@/lib/auth-redirect";
import { getActiveLocale } from "@/lib/i18n";
import { requestPasswordReset, fetchUserAccess, deleteUserAccount } from "@/lib/api";
import {
  refreshUserEntitlements,
  restorePurchases as restorePurchasesFromStore,
  startProPurchase
} from "@/lib/subscription/entitlements";
import { getSessionSafely } from "@/lib/mobile-http";
import { withTimeout } from "@/lib/with-timeout";
import { supabase } from "@/lib/supabase";
import { unregisterExpoPushToken } from "@/lib/notifications/register";
import type { UserAccessSummary } from "@/lib/types";

export interface SignUpResult {
  alreadyRegistered: boolean;
  needsConfirmation: boolean;
  message: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  access: UserAccessSummary | null;
  subscription: SubscriptionEntitlement;
  userStatus: UserAccessStatus;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  restorePurchases: () => Promise<{ restored: boolean }>;
  activateProPurchase: () => Promise<{ completed: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultSubscription: SubscriptionEntitlement = { state: "none", renewsAt: null };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<UserAccessSummary | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionEntitlement>(defaultSubscription);
  const [loading, setLoading] = useState(true);
  const signingOutRef = useRef(false);

  const refreshAccess = useCallback(async () => {
    if (!session?.user) {
      setAccess(null);
      setSubscription(defaultSubscription);
      return;
    }
    const userId = session.user.id;
    const [summary, entitlement] = await Promise.all([
      fetchUserAccess().catch(() => null),
      refreshUserEntitlements(userId)
    ]);
    setAccess(summary);
    setSubscription(entitlement);
  }, [session?.user]);

  useEffect(() => {
    let mounted = true;

    void getSessionSafely()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        signingOutRef.current = false;
        setSession(nextSession);
        return;
      }
      if (signingOutRef.current && event !== "SIGNED_OUT") {
        return;
      }
      if (event === "SIGNED_OUT") {
        signingOutRef.current = false;
      }
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAccess(null);
      setSubscription(defaultSubscription);
      return;
    }
    void refreshAccess();
  }, [session, refreshAccess]);

  const signIn = useCallback(async (email: string, password: string) => {
    signingOutRef.current = false;
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      }),
      20_000,
      "auth_timeout"
    );
    if (error) throw error;
    if (data.session) setSession(data.session);
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    signingOutRef.current = false;
    const normalizedEmail = email.trim();
    const locale = getActiveLocale();
    const welcomeNext = `/account/welcome?locale=${locale}`;
    const emailRedirectTo = ensureWebAuthRedirect(signupEmailRedirectUrl(locale), welcomeNext);
    console.warn("[auth] signUp redirect", emailRedirectTo);
    let { data, error } = await withTimeout(
      supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo,
          data: { locale }
        }
      }),
      20_000,
      "auth_timeout"
    );
    if (
      error &&
      (error.message.toLowerCase().includes("redirect") || error.code === "validation_failed")
    ) {
      const retry = await withTimeout(
        supabase.auth.signUp({
          email: normalizedEmail,
          password
        }),
        20_000,
        "auth_timeout"
      );
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.warn("[auth] signUp failed", error.code, error.message);
      throw error;
    }

    if (data.user?.identities?.length === 0) {
      return {
        alreadyRegistered: true,
        needsConfirmation: false,
        message:
          "Questa email è già registrata. Accedi con la password o usa Recupera password."
      };
    }

    const needsConfirmation = !data.session;
    return {
      alreadyRegistered: false,
      needsConfirmation,
      message: needsConfirmation
        ? "Ti abbiamo inviato un'email di conferma. Apri il link per attivare l'account, poi accedi."
        : "Account creato. Ora puoi accedere."
    };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: ensureWebAuthRedirect(
          signupEmailRedirectUrl(getActiveLocale()),
          `/account/welcome?locale=${getActiveLocale()}`
        )
      }
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const locale = getActiveLocale();
    try {
      await requestPasswordReset(email.trim(), locale);
      return;
    } catch (apiError) {
      console.warn("[auth] resetPassword api failed", apiError);
      const redirectTo = ensureWebAuthRedirect(
        passwordResetRedirectUrl(locale),
        `/set-password?locale=${locale}`
      );
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo
      });
      if (error) {
        console.warn("[auth] resetPassword fallback failed", error.code, error.message);
        throw error;
      }
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const clearLocalAuth = useCallback(() => {
    setSession(null);
    setAccess(null);
    setSubscription(defaultSubscription);
  }, []);

  const signOut = useCallback(async () => {
    signingOutRef.current = true;
    try {
      await withTimeout(unregisterExpoPushToken(), 2_500, "push_unregister_timeout").catch(() => undefined);
    } catch {
      // ignore
    }
    clearLocalAuth();
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 3_000, "signout_timeout");
    } catch {
      // ignore
    } finally {
      signingOutRef.current = false;
    }
  }, [clearLocalAuth]);

  const deleteAccount = useCallback(async () => {
    if (!session?.user) {
      throw new Error("not_authenticated");
    }
    signingOutRef.current = true;
    try {
      await deleteUserAccount();
    } catch (error) {
      signingOutRef.current = false;
      throw error;
    }
    clearLocalAuth();
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 3_000, "signout_timeout");
    } catch {
      // ignore
    } finally {
      signingOutRef.current = false;
    }
  }, [clearLocalAuth, session?.user]);

  const restorePurchases = useCallback(async () => {
    if (!session?.user) return { restored: false };
    const result = await restorePurchasesFromStore(session.user.id);
    setSubscription(result.entitlement);
    await refreshAccess();
    return { restored: result.restored };
  }, [refreshAccess, session?.user]);

  const activateProPurchase = useCallback(async () => {
    if (!session?.user) {
      return {
        completed: false,
        message:
          "Per attivare PitchBrain Pro è necessario creare un account. Ti servirà per recuperare il piano e usarlo su più dispositivi."
      };
    }
    const result = await startProPurchase(session.user.id);
    if (result.completed) {
      await refreshAccess();
    }
    return result;
  }, [refreshAccess, session?.user]);

  const userStatus = useMemo(
    () => deriveUserAccessStatus(session, access, subscription),
    [session, access, subscription]
  );

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      access,
      subscription,
      userStatus,
      loading,
      isGuest: userStatus === "guest",
      signIn,
      signUp,
      resendConfirmation,
      resetPassword,
      updatePassword,
      signOut,
      deleteAccount,
      refreshAccess,
      restorePurchases,
      activateProPurchase
    }),
    [
      session,
      access,
      subscription,
      userStatus,
      loading,
      signIn,
      signUp,
      resendConfirmation,
      resetPassword,
      updatePassword,
      signOut,
      deleteAccount,
      refreshAccess,
      restorePurchases,
      activateProPurchase
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
