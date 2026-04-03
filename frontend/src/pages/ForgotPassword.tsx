import React, { useState } from "react";
import { Link } from "react-router-dom";
import FofotiLogo from "../components/FofotiLogo";
import toast from "react-hot-toast";
import api from "../api";
import { useLang } from "../contexts/LanguageContext";

export default function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        toast.error("Too many requests. Please wait a while and try again.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t.forgotPasswordTitle}</h1>

          {sent ? (
            <div className="text-center py-4">
              <p className="text-gray-600 mb-4">{t.resetEmailSent}</p>
              <Link to="/login" className="text-ocean-600 hover:underline font-medium text-sm">
                {t.backToSignIn}
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6">{t.forgotPasswordSub}</p>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                  {loading ? t.sending : t.sendResetLink}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                <Link to="/login" className="text-ocean-600 hover:underline font-medium">{t.backToSignIn}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
