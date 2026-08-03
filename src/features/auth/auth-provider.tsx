import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/features/auth/supabase-client';
import { clearAuthNavigationState } from '@/features/auth/auth-navigation-state';

type AuthContextValue = {
  configured: boolean;
  initializing: boolean;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue>({
  configured: false,
  initializing: true,
  session: null,
  user: null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(configured);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setInitializing(false);
      return;
    }
    let active = true;
    let authEventObserved = false;
    void client.auth.getSession().then(({ data }) => {
      if (active) {
        if (!authEventObserved) setSession(data.session);
        setInitializing(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      authEventObserved = true;
      if (event === 'SIGNED_OUT') clearAuthNavigationState();
      setSession(nextSession);
    });
    const updateAutoRefresh = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    updateAutoRefresh(AppState.currentState);
    const appStateSubscription = AppState.addEventListener(
      'change',
      updateAutoRefresh
    );
    return () => {
      active = false;
      appStateSubscription.remove();
      client.auth.stopAutoRefresh();
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ configured, initializing, session, user: session?.user ?? null }),
    [configured, initializing, session]
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  return use(AuthContext);
}
