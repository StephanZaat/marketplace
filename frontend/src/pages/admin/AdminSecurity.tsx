import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import AdminHeader from "../../components/AdminHeader";
import { useAdminAuth } from "../../contexts/AdminAuthContext";
import adminApi from "../../adminApi";
import toast from "react-hot-toast";

interface TotpSetup {
  qr_uri: string;
  secret: string;
  enabled: boolean;
}

export default function AdminSecurity() {
  const { admin } = useAdminAuth();
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  async function loadSetup() {
    const res = await adminApi.get("/admin/auth/totp/setup");
    setSetup(res.data);
    if (res.data.qr_uri) {
      const url = await QRCode.toDataURL(res.data.qr_uri, { width: 180, margin: 1 });
      setQrDataUrl(url);
    }
  }

  useEffect(() => {
    loadSetup();
  }, []);

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.post("/admin/auth/totp/enable", { code });
      toast.success("2FA enabled");
      setCode("");
      setShowSetup(false);
      await loadSetup();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.post("/admin/auth/totp/disable", { code });
      toast.success("2FA disabled");
      setCode("");
      await loadSetup();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  const totpEnabled = setup?.enabled ?? false;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Security</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            {totpEnabled ? (
              <ShieldCheck size={24} className="text-green-600" />
            ) : (
              <Shield size={24} className="text-gray-400" />
            )}
            <div>
              <h2 className="font-semibold text-gray-900">Two-factor authentication (TOTP)</h2>
              <p className="text-sm text-gray-500">
                {totpEnabled
                  ? "2FA is enabled. Your account is protected."
                  : "Add an extra layer of security to your admin account."}
              </p>
            </div>
            <span
              className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${
                totpEnabled
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {totpEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {!totpEnabled && (
            <>
              {!showSetup ? (
                <button
                  onClick={() => setShowSetup(true)}
                  className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Enable 2FA
                </button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
                    then enter the 6-digit code below to confirm.
                  </p>
                  {setup?.qr_uri && (
                    <div className="flex flex-col items-start gap-4">
                      <div className="p-3 bg-white border border-gray-200 rounded-lg inline-block">
                        {qrDataUrl && <img src={qrDataUrl} alt="TOTP QR code" width={180} height={180} />}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Or enter the secret manually:</p>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {setup.secret}
                        </code>
                      </div>
                    </div>
                  )}
                  <form onSubmit={handleEnable} className="flex gap-2 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Verification code
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-400"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || code.length !== 6}
                      className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Verifying…" : "Confirm & enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowSetup(false); setCode(""); }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-2"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {totpEnabled && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                To disable 2FA, enter your current authenticator code:
              </p>
              <form onSubmit={handleDisable} className="flex gap-2 items-end">
                <div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-400"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <ShieldOff size={14} />
                  {loading ? "Disabling…" : "Disable 2FA"}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
          <h2 className="font-semibold text-gray-900 mb-1">Session info</h2>
          <p className="text-sm text-gray-500">
            Logged in as <span className="font-medium text-gray-700">{admin?.username}</span>.
            Admin sessions expire after 8 hours.
          </p>
        </div>
      </main>
    </div>
  );
}
