import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";

const SUBJECTS = [
  "General question",
  "Report a problem",
  "Account issue",
  "Safety concern",
  "Other",
];

export default function Contact() {
  const { user } = useAuth();
  const { t } = useLang();
  const [form, setForm] = useState({
    name: user?.full_name ?? "",
    email: user?.email ?? "",
    subject: SUBJECTS[0],
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/contact", form);
      setDone(true);
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="mb-6">
        <Link to="/" className="text-sm text-ocean-600 hover:underline">← Back to home</Link>
      </div>

      <div className="card p-8">
        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t.messageSent}</h1>
            <p className="text-gray-500 text-sm mb-6">{t.messageSentSub}</p>
            <Link to="/" className="btn-primary">{t.backToHome}</Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-ocean-100 text-ocean-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{t.contactTitle}</h1>
                <p className="text-sm text-gray-500">{t.contactSub}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.name} *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={set("name")}
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.subject} *</label>
                <select value={form.subject} onChange={set("subject")} className="input">
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.message} *</label>
                <textarea
                  value={form.message}
                  onChange={set("message")}
                  required
                  rows={5}
                  className="input resize-none"
                  placeholder="How can we help you?"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t.sending : t.sendMessage}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
