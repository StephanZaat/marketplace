import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import adminApi from "../adminApi";

interface AdminUser {
  id: number;
  username: string;
  totp_enabled: boolean;
}

interface AdminAuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  preAuthToken: string | null;
  totpRequired: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ totpRequired: boolean }>;
  verifyTotp: (code: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [totpRequired, setTotpRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    adminApi
      .get("/admin/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setAdmin(res.data))
      .catch(() => {
        localStorage.removeItem("admin_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(username: string, password: string) {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const res = await adminApi.post("/admin/auth/token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (res.data.totp_required) {
      setPreAuthToken(res.data.access_token);
      setTotpRequired(true);
      return { totpRequired: true };
    }
    const t = res.data.access_token;
    localStorage.setItem("admin_token", t);
    setToken(t);
    const me = await adminApi.get("/admin/auth/me", { headers: { Authorization: `Bearer ${t}` } });
    setAdmin(me.data);
    return { totpRequired: false };
  }

  async function verifyTotp(code: string) {
    if (!preAuthToken) throw new Error("No pre-auth token");
    const res = await adminApi.post(
      "/admin/auth/totp/verify",
      { code },
      { headers: { Authorization: `Bearer ${preAuthToken}` } }
    );
    const t = res.data.access_token;
    localStorage.setItem("admin_token", t);
    setToken(t);
    setPreAuthToken(null);
    setTotpRequired(false);
    const me = await adminApi.get("/admin/auth/me", { headers: { Authorization: `Bearer ${t}` } });
    setAdmin(me.data);
  }

  function logout() {
    localStorage.removeItem("admin_token");
    setToken(null);
    setAdmin(null);
    setPreAuthToken(null);
    setTotpRequired(false);
  }

  return (
    <AdminAuthContext.Provider value={{ admin, token, preAuthToken, totpRequired, loading, login, verifyTotp, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
