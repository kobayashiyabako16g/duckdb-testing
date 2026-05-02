import { createContext, useContext, useEffect, useState } from "react";
import { getCFUser, type CFUser } from "~/lib/auth";

interface AuthContextValue {
  user: CFUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<CFUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cfUser = getCFUser();
    setUser(cfUser);
    setIsLoading(false);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
};
