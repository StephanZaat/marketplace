import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api, { UserMe } from "../api";
import { useLang, Lang } from "./LanguageContext";

interface AuthContextType {
  user: UserMe | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<UserMe>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const { setLang } = useLang();

  const applyUserLang = (u: UserMe) => {
    const pref = u.preferred_language as Lang | null;
    if (pref === "en" || pref === "es") setLang(pref);
  };

  useEffect(() => {
    if (token) {
      api.get<UserMe>("/auth/me")
        .then((res) => { setUser(res.data); applyUserLang(res.data); })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (newToken: string): Promise<UserMe> => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    const res = await api.get<UserMe>("/auth/me", {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    setUser(res.data);
    applyUserLang(res.data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
