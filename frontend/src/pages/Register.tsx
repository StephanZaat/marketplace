import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import FofotiLogo from "../components/FofotiLogo";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";
import SocialLoginButtons from "../components/SocialLoginButtons";

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"];
  return { score, label: labels[score] ?? "Strong", color: colors[score] ?? "bg-green-500" };
}

export default function Register() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const strength = passwordStrength(form.password);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strength.score < 3) {
      toast.error("Password must be at least 8 characters with uppercase, lowercase, and a number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>("/auth/register", form);
      const me = await login(res.data.access_token);
      toast.success("Welcome to Marketplace.aw!");
      navigate("/settings");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Registration failed";
      toast.error(msg);
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
          <h1 className="text-xl font-bold text-gray-900 mb-6">{t.createAccount}</h1>

          <SocialLoginButtons onSuccess={() => navigate("/settings")} />

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.fullName} *</label>
              <input
                type="text"
                value={form.full_name}
                onChange={set("full_name")}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email} *</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.password} *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  required
                  className="input pr-10"
                  placeholder={t.passwordHint}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {strength.label} — {t.passwordHint}
                  </p>
                </div>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? t.creating : t.createAccount}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t.alreadyHaveAccount}{" "}
            <Link to="/login" className="text-ocean-600 hover:underline font-medium">{t.signIn}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
