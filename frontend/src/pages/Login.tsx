import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import FofotiLogo from "../components/FofotiLogo";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";

type Step = "email" | "otp";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [code, setCode] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "otp") codeRef.current?.focus();
  }, [step]);

  const sendOtp = async (showToast = true) => {
    setLoading(true);
    try {
      const res = await api.post<{ otp_token: string; is_new_user: boolean }>("/auth/otp-send", { email });
      setOtpToken(res.data.otp_token);
      setIsNewUser(res.data.is_new_user);
      setStep("otp");
      setCode("");
      if (showToast) toast.success(t.otpSent);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        toast.error(t.otpTooManyRequests);
      } else {
        toast.error(t.otpErrorGeneric);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendOtp();
  };

  const handleResend = async () => {
    setResending(true);
    await sendOtp(true);
    setResending(false);
  };

  const verifyOtp = async (otpCode: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>("/auth/otp-verify", {
        email,
        code: otpCode,
        otp_token: otpToken,
        full_name: isNewUser ? fullName || undefined : undefined,
      });
      const me = await login(res.data.access_token);
      navigate(`/profile/${me.id}`);
    } catch {
      toast.error(t.otpInvalidCode);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 6);
    setCode(cleaned);
    if (cleaned.length === 6) verifyOtp(cleaned);
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t.signInTitle}</h1>

          {step === "email" && (
            <>
              <p className="text-sm text-gray-500 mb-6">{t.enterEmail}</p>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="input"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? t.codeSending : t.continueBtn}
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <div className="space-y-4 mt-4">
              <p className="text-sm text-gray-500">{t.codeSentTo} <strong>{email}</strong></p>

              {isNewUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.fullName}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t.fullName}
                    className="input"
                  />
                </div>
              )}

              <div>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder={t.otpPlaceholder}
                  maxLength={6}
                  className="input text-center text-2xl font-mono tracking-[0.3em]"
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              </div>

              {loading && (
                <p className="text-sm text-gray-400 text-center">{t.verifying}</p>
              )}

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); }}
                  className="text-ocean-600 hover:underline"
                >
                  {t.changeEmail}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-ocean-600 hover:underline disabled:opacity-50"
                >
                  {resending ? t.codeSending : t.resendCode}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
