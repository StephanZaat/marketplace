import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../contexts/AdminAuthContext";
import toast from "react-hot-toast";

export default function AdminLogin() {
  const { login, verifyTotp, totpRequired } = useAdminAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(username, password);
      if (!result.totpRequired) {
        navigate("/admin");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyTotp(totpCode);
      navigate("/admin");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm card p-8">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <span className="text-2xl leading-none">🇦🇼</span>
            <span className="font-extrabold text-2xl">
              <span className="text-ocean-700">Marketplace</span><span className="text-sand-500">.aw</span>
            </span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Admin sign in</h1>
        </div>

        {!totpRequired ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input text-sm"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-sm"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Enter your 6-digit authenticator code
            </p>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="input text-center tracking-widest text-lg"
              required
              autoFocus
              maxLength={6}
            />
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="btn-primary w-full text-sm"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
