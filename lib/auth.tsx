import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { configured, setAuthRefreshActive, supabase } from "./supabase";

const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  configured: boolean;
}>({ session: null, loading: true, configured });
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let active = true;
    let receivedAuthEvent = false;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      if (active && !receivedAuthEvent) setSession(data.session);
    }).catch((error) => {
      console.warn("Could not restore sign-in session", error);
    }).finally(() => {
      if (active) setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        receivedAuthEvent = true;
        setSession(next);
        setLoading(false);
      }
    });
    // Browser visibility is managed by Supabase. Native apps need AppState.
    const updateRefresh = (state: string | null | undefined) => {
      const task = setAuthRefreshActive(state === "active");
      void task.catch((error) => console.warn("Could not update auth refresh", error));
    };
    const appStateSubscription = Platform.OS !== "web"
      ? AppState.addEventListener("change", updateRefresh)
      : undefined;
    if (Platform.OS !== "web") updateRefresh(AppState.currentState);
    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== "web") updateRefresh("background");
    };
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading, configured }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
