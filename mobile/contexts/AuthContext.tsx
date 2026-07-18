import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { deriveUserAccessStatus } from "@/lib/access/user-status";
import type { SubscriptionEntitlement, UserAccessStatus } from "@/lib/access/types";
import { fetchUserAccess } from "@/lib/api";
import {
  refreshUserEntitlements,
  restorePurchases as restorePurchasesFromStore,
  startProPurchase
} from "@/lib/subscription/entitlements";
import { supabase } from "@/lib/supabase";
import type { UserAccessSummary } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  access: UserAccessSummary | null;
  subscription: SubscriptionEntitlement;
  userStatus: UserAccessStatus;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  const refreshAccess = useCallback(async () => {
    if (!session?.user) {
      setAccess(null);
      setSubscription(defaultSubscription);
      return;
    }
    try {
      const [summary, entitlement] = await Promise.all([
        fetchUserAccess(),
        refreshUserEntitlements(session.user.id)
      ]);
      setAccess(summary);
      setSubscription(entitlement);
    } catch {
      setAccess(null);
      setSubscription(defaultSubscription);
    }
  }, [session?.user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAccess(null);
    setSubscription(defaultSubscription);
  }, []);

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
      signOut,
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
      signOut,
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
