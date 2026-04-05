import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { type User } from '@/services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = api.getToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const verification = await api.verifyAuthToken(token);
        if (verification?.success && verification.user) {
          setUser(verification.user);
          localStorage.setItem('user', JSON.stringify(verification.user));
        } else {
          api.logout();
          setUser(null);
        }
      } catch {
        api.logout();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await api.login(email, password);
      const token = data.accessToken || data.token;

      if (token) {
        api.setToken(token);
      }

      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      return { success: true };

    } catch (err: unknown) {
      const errorResponse = err && typeof err === 'object' && 'response' in err ? (err as { response: { data?: { message?: string; requiresVerification?: boolean; email?: string } } }).response : null;
      const errorMessage = errorResponse?.data?.message || (err instanceof Error ? err.message : 'Login failed');

      if (errorResponse?.data?.requiresVerification) {
        return {
          success: false,
          requiresVerification: true,
          email: errorResponse.data.email,
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };
  

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
