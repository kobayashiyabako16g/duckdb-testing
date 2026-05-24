import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  fetchMe,
  getStoredIdToken,
  setStoredIdToken,
  type AppTenant,
  type AppUser,
} from "~/lib/auth";

interface AuthContextValue {
  user: AppUser | null;
  tenant: AppTenant | null;
  email: string | null;
  needsOnboarding: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (idToken: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const defaultValue: AuthContextValue = {
  user: null,
  tenant: null,
  email: null,
  needsOnboarding: false,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
  refresh: async () => {},
};

const AuthContext = createContext<AuthContextValue>(defaultValue);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [tenant, setTenant] = useState<AppTenant | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getStoredIdToken();
    if (!token) {
      setUser(null);
      setTenant(null);
      setEmail(null);
      setNeedsOnboarding(false);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    const me = await fetchMe();
    if (!me) {
      // 期限切れなど → ログアウト相当
      setStoredIdToken(null);
      setUser(null);
      setTenant(null);
      setEmail(null);
      setNeedsOnboarding(false);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }
    setUser(me.user);
    setTenant(me.tenant);
    setEmail(me.email);
    setNeedsOnboarding(me.needsOnboarding);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (idToken: string) => {
      setStoredIdToken(idToken);
      setIsLoading(true);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    setStoredIdToken(null);
    setUser(null);
    setTenant(null);
    setEmail(null);
    setNeedsOnboarding(false);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        email,
        needsOnboarding,
        isAuthenticated,
        isLoading,
        signIn,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
