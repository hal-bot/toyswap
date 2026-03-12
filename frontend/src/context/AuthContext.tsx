import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { Swapper } from '../types/api';

interface AuthContextType {
  user: Swapper | null;
  login: (swapper: Swapper) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export { AuthContext };

const STORAGE_KEY = 'toyswap_userId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Swapper | null>(null);

  // On mount, re-hydrate from sessionStorage (paired with userId in localStorage)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // Restore minimal user object so ProtectedRoute can pass guards.
      // Full Swapper is loaded on real login; for refresh survival we store it.
      const storedUser = localStorage.getItem('toyswap_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('toyswap_user');
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, []);

  function login(swapper: Swapper) {
    setUser(swapper);
    localStorage.setItem(STORAGE_KEY, swapper.userId);
    localStorage.setItem('toyswap_user', JSON.stringify(swapper));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('toyswap_user');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
