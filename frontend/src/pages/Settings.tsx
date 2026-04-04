import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Camera, Trash2, ArrowDownToLine, Info } from "lucide-react";
import toast from "react-hot-toast";
import api, { UserMe } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { ARUBA_AREAS } from "../lib/arubaAreas";
import PhoneInput from "../components/PhoneInput";
import { useLang } from "../contexts/LanguageContext";

const WaIcon = () => (
  <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.571a.75.75 0 00.943.878l5.919-1.953A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.614-.498-5.13-1.373l-.368-.217-3.814 1.259 1.198-3.698-.237-.381A9.943 9.943 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);

interface FormData {
  full_name: string;
  location: string;
  email: string;
  phone: string;
  whatsapp: string;
}

export default function Settings() {
  const { user, login } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [languages, setLanguages] = useState<string[]>(
    () => {
      const saved = user?.languages?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
      if (saved.length > 0) return saved;
      return lang === "es" ? ["spanish"] : ["english"];
    }
  );
  const [showPhone, setShowPhone] = useState(
    () => !!user?.contact_method?.includes("phone")
  );
  const [showWhatsapp, setShowWhatsapp] = useState(
    () => !!user?.contact_method?.includes("whatsapp")
  );
  const [preferredLang, setPreferredLang] = useState<string>(
    () => user?.preferred_language ?? lang
  );

  const { register, handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: {
      full_name: user?.full_name ?? "",
      location: user?.location ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      whatsapp: user?.whatsapp ?? "",
    },
  });

  const watchPhone = watch("phone");
  const watchWhatsapp = watch("whatsapp");

  if (!user) {
    navigate("/login");
    return null;
  }

  const refreshUser = async () => {
    const token = localStorage.getItem("token");
    if (token) await login(token);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<UserMe>("/users/me/avatar", form);
      setAvatarUrl(res.data.avatar_url);
      await refreshUser();
      toast.success(t.avatarUpdated);
    } catch {
      toast.error(t.failedToUploadAvatar);
    } finally {
      setUploadingAvatar(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await api.delete<UserMe>("/users/me/avatar");
      setAvatarUrl(null);
      await refreshUser();
      toast.success(t.avatarRemoved);
    } catch {
      toast.error(t.failedToRemoveAvatar);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (languages.length === 0) {
      toast.error(t.spokenRequired);
      return;
    }
    setSaving(true);
    try {
      const { email: _email, ...patch } = data;
      const methods: string[] = [];
      if (showPhone && data.phone) methods.push("phone");
      if (showWhatsapp && data.whatsapp) methods.push("whatsapp");
      await api.patch<UserMe>("/users/me", {
        ...patch,
        contact_method: methods.join(",") || null,
        languages: languages.join(",") || null,
        preferred_language: preferredLang,
      });
      await refreshUser();
      setLang(preferredLang as "en" | "es");
      toast.success(t.profileUpdated);
      navigate(`/profile/${user.id}`);
    } catch {
      toast.error(t.failedToSaveProfile);
    } finally {
      setSaving(false);
    }
  };

  const initials = (user.full_name ?? user.email)[0].toUpperCase();

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t.settingsTitle}</h1>

      {/* Avatar section */}
      <div className="card p-6 mb-5 flex items-center gap-5">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center text-3xl font-bold">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ocean-600 text-white flex items-center justify-center hover:bg-ocean-700 transition-colors shadow"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 mb-1">{t.profilePicture}</p>
          <p className="text-xs text-gray-400 mb-3">{t.profilePictureHint}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingAvatar ? t.uploadingAvatar : avatarUrl ? t.changeAvatar : t.uploadAvatar}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-xs py-1.5 px-3 text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.removeAvatar}
              </button>
            )}
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.fieldFullName}</label>
          <input {...register("full_name")} className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.fieldLocation}</label>
          <select {...register("location")} className="input">
            <option value="">{t.selectArea}</option>
            {ARUBA_AREAS.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.fieldEmail}</label>
          <input
            {...register("email")}
            type="email"
            className="input bg-gray-50 text-gray-500 cursor-not-allowed"
            readOnly
          />
          <p className="text-xs text-gray-400 mt-1">{t.emailChangeHint}</p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">{t.communications}</label>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="w-8 text-sm font-medium text-gray-700 shrink-0">📞</label>
              <div className="flex-1">
                <PhoneInput
                  value={watchPhone}
                  onChange={(v) => { setValue("phone", v, { shouldDirty: true }); if (v) setShowPhone(true); }}
                  placeholder={t.phonePlaceholder}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 shrink-0" />
              <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="rounded"
                  disabled={!watchPhone}
                />
                {t.publicLabel}
                <span className="relative group">
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                  <span className="pointer-events-none absolute left-0 top-5 z-20 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.phonePublicTooltip}
                  </span>
                </span>
              </label>
            </div>
          </div>
          {watchPhone && (
            <div className="flex items-center gap-3">
              <div className="w-8 shrink-0" />
              <button
                type="button"
                onClick={() => { setValue("whatsapp", watchPhone, { shouldDirty: true }); setShowWhatsapp(showPhone); }}
                className="flex items-center gap-1 text-xs text-ocean-600 hover:text-ocean-700 font-medium"
                title={t.sameForWhatsapp}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                {t.sameForWhatsapp}
              </button>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="w-8 shrink-0 flex items-center"><WaIcon /></label>
              <div className="flex-1">
                <PhoneInput
                  value={watchWhatsapp}
                  onChange={(v) => { setValue("whatsapp", v, { shouldDirty: true }); if (v) setShowWhatsapp(true); }}
                  placeholder={t.whatsappPlaceholder}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 shrink-0" />
              <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showWhatsapp}
                  onChange={(e) => setShowWhatsapp(e.target.checked)}
                  className="rounded"
                  disabled={!watchWhatsapp}
                />
                {t.publicLabel}
                <span className="relative group">
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                  <span className="pointer-events-none absolute left-0 top-5 z-20 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.whatsappPublicTooltip}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">{t.languagesSpoken}</label>
          <div className="inline-grid grid-cols-[auto_auto] gap-x-6 gap-y-2 items-center">
            {/* header row */}
            <span className="flex items-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wide" title={t.spokenTooltip}>
              {t.spokenHeader}
              <Info className="w-3 h-3 shrink-0 cursor-default" />
            </span>
            <span className="flex items-center justify-center gap-1 text-xs font-medium text-gray-400 uppercase tracking-wide" title={t.siteTooltip}>
              {t.siteHeader}
              <Info className="w-3 h-3 shrink-0 cursor-default" />
            </span>
            {([
              ["english",    t.langEnglish,    "en"],
              ["spanish",    t.langSpanish,    "es"],
              ["papiamento", t.langPapiamento, null],
              ["dutch",      t.langDutch,      null],
            ] as [string, string, string | null][]).map(([lang, label, uiCode]) => {
              const checked = languages.includes(lang);
              return (
                <React.Fragment key={lang}>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (!e.target.checked && languages.length <= 1) return;
                        const next = e.target.checked
                          ? [...languages, lang]
                          : languages.filter(l => l !== lang);
                        setLanguages(next);
                        if (!e.target.checked && uiCode && preferredLang === uiCode) {
                          // Switch site language to the next spoken language that has a UI code
                          const uiLangs: [string, string][] = [["english", "en"], ["spanish", "es"]];
                          const nextUi = uiLangs.find(([l, c]) => l !== lang && next.includes(l));
                          setPreferredLang(nextUi ? nextUi[1] : "en");
                        }
                      }}
                      className="rounded"
                    />
                    {label}
                  </label>
                  <div className="flex justify-center">
                    {uiCode ? (
                      <input
                        type="radio"
                        name="preferred_language"
                        value={uiCode}
                        checked={preferredLang === uiCode}
                        onChange={() => { setPreferredLang(uiCode); if (!checked) setLanguages(prev => [...prev, lang]); }}
                        className="accent-ocean-600"
                      />
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? t.saving : t.saveChanges}
          </button>
          <button type="button" onClick={() => navigate(`/profile/${user.id}`)} className="btn-secondary px-6">
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
