import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { configured, supabase } from './supabase';

const AuthContext = createContext<{session: Session | null; loading: boolean; configured: boolean}>({ session: null, loading: true, configured });
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={{ session, loading, configured }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
