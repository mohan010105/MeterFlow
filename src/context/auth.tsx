import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import {
  signInUser,
  signUpUser,
  signOutUser,
} from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track whether initial session check has completed
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 1. Check existing session first to set initial state
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          logger.debug("Auth initialized, session:", initialSession ? "present" : "none");
        }
      } catch (err) {
        logger.error("Auth initialization failed:", err);
        // On error, ensure we clean up any stale state
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setInitialized(true);
        }
      }
    };

    initAuth();

    // 2. Subscribe to auth changes (fires AFTER getSession)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        logger.debug("Auth state changed:", _event, newSession ? "session" : "no session");
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // Only clear loading if we haven't initialized yet
        // (avoids race with getSession)
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInUser(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    await signUpUser(email, password, displayName);
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const auth: AuthState = {
    isAuthenticated: !!session,
    isLoading,
    user,
    session,
    signIn,
    signUp,
    signOut,
  };

  // Inject auth state into router context so beforeLoad guards see it.
  // Only do this after initialization to prevent premature redirects.
  useEffect(() => {
    if (!initialized) return;
    router.update({ context: { auth } });
    // Invalidate cached route matches so guards re-evaluate with fresh auth
    router.invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, session, isLoading]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
