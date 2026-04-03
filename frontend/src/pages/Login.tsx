import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FofotiLogo from "../components/FofotiLogo";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";
import SocialLoginButtons from "../components/SocialLoginButtons";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>("/auth/login", { email, password });
      const me = await login(res.data.access_token);
      navigate(`/profile/${me.id}`);
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-50 to-ocean-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <FofotiLogo className="w-10 h-10 text-ocean-600" />
            <span className="text-2xl font-bold text-ocean-700">Marketplace<span className="text-sand-500">.aw</span></span>
          </Link>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-6">{t.welcomeBack}</h1>

          <SocialLoginButtons onSuccess={(id) => navigate(`/profile/${id}`)} />

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t.signingIn : t.signIn}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            <Link to="/forgot-password" className="text-ocean-600 hover:underline">{t.forgotPassword}</Link>
          </p>

          <p className="text-center text-sm text-gray-500 mt-3">
            {t.noAccount}{" "}
            <Link to="/register" className="text-ocean-600 hover:underline font-medium">{t.signUp}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
