"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearTokens,
  fetchMe,
  getStoredAccessToken,
  loginRequest,
  logoutRequest,
  persistTokens,
} from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

const USER_KEY = "da_user";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  ready: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUserFromStorage(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function saveUser(user: User | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const access = getStoredAccessToken();
    const cached = loadUserFromStorage();
    /* eslint-disable react-hooks/set-state-in-effect -- restauration session (localStorage) */
    setAccessToken(access);
    setUser(cached);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    saveUser(me);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    persistTokens(res.access, res.refresh);
    setAccessToken(res.access);
    setUser(res.user);
    saveUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearTokens();
    saveUser(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      ready,
      login,
      logout,
      refreshUser,
    }),
    [user, accessToken, ready, login, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}

export function useOptionalRole(): UserRole | undefined {
  const { user } = useAuth();
  return user?.role;
}
