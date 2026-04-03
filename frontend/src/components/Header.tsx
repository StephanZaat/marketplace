import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, PlusCircle, User, Menu, X, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";
import SearchInput from "./SearchInput";
import api from "../api";

export default function Header() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const { currency, setCurrency } = useCurrency();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const fetchUnread = () => {
      api.get<{ count: number }>("/messages/unread").then(r => setUnreadCount(r.data.count)).catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [user, location.pathname]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0 gap-1.5 group">
            <span className="text-xl leading-none">🇦🇼</span>
            <span className="font-extrabold text-xl"><span className="text-ocean-700 group-hover:text-ocean-600 transition-colors">Marketplace</span><span className="text-sand-500">.aw</span></span>
          </Link>

          {/* Search */}
          <SearchInput
            className="flex-1 max-w-lg hidden md:block"
            inputClassName="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent focus:bg-white transition-colors"
            placeholder={t.searchPlaceholder}
            syncUrl
          />

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="px-3 py-1 text-xs font-semibold text-gray-500 hover:text-ocean-600 hover:bg-ocean-50 rounded-full transition-colors border border-gray-200 hover:border-ocean-200"
              title={lang === "en" ? "Cambiar a español" : "Switch to English"}
            >
              {lang === "en" ? "🇪🇸 Español" : "🇬🇧 English"}
            </button>
            {/* Currency toggle */}
            <button
              onClick={() => setCurrency(currency === "AWG" ? "USD" : "AWG")}
              className="px-3 py-1 text-xs font-semibold text-gray-500 hover:text-ocean-600 hover:bg-ocean-50 rounded-full transition-colors border border-gray-200 hover:border-ocean-200"
              title={currency === "AWG" ? "Switch to US Dollar" : "Switch to Aruban Florin"}
            >
              {currency === "AWG" ? "$ USD" : "ƒ AWG"}
            </button>

            {user ? (
              <>
                <Link
                  to="/listings/new"
                  className="flex items-center gap-1.5 px-4 py-2 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-semibold rounded-full transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  {t.sell}
                </Link>
                <Link to="/messages" className="relative p-2 text-gray-500 hover:text-ocean-600 hover:bg-ocean-50 rounded-full transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Link to={`/profile/${user.id}`} className="flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:text-ocean-600 hover:bg-ocean-50 rounded-full transition-colors text-sm font-medium">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name ?? t.profile} className="w-6 h-6 rounded-full object-cover ring-2 ring-ocean-200" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-ocean-100 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-ocean-600" />
                    </div>
                  )}
                  <span className="hidden lg:block">{user.full_name}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title={t.logOut}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-gray-700 hover:text-ocean-600 text-sm font-medium rounded-full hover:bg-ocean-50 transition-colors">
                  {t.logIn}
                </Link>
                <Link to="/register" className="px-4 py-2 bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-semibold rounded-full transition-colors">
                  {t.signUp}
                </Link>
              </>
            )}
          </nav>

          <button className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3 shadow-lg">
          <SearchInput
            inputClassName="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
            placeholder={t.searchPlaceholder}
            onSubmit={() => setMenuOpen(false)}
          />
          {user ? (
            <>
              <Link to="/listings/new" className="flex items-center justify-center gap-2 py-2.5 bg-ocean-600 text-white font-semibold rounded-xl w-full" onClick={() => setMenuOpen(false)}>
                <PlusCircle className="w-4 h-4" /> {t.sellSomething}
              </Link>
              <Link to="/messages" className="flex items-center justify-between py-2 text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>
                {t.messages}
                {unreadCount > 0 && (
                  <span className="min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link to={`/profile/${user.id}`} className="block py-2 text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>{t.profile}</Link>
              <button onClick={() => { logout(); setMenuOpen(false); }} className="block py-2 text-red-500 font-medium w-full text-left">{t.logOut}</button>
            </>
          ) : (
            <>
              <Link to="/login" className="block text-center py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl w-full" onClick={() => setMenuOpen(false)}>{t.logIn}</Link>
              <Link to="/register" className="block text-center py-2.5 bg-ocean-600 text-white font-semibold rounded-xl w-full" onClick={() => setMenuOpen(false)}>{t.signUp}</Link>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="flex-1 text-center py-2 text-sm text-gray-500 font-medium border border-gray-200 rounded-lg"
            >
              {lang === "en" ? "🇪🇸 Español" : "🇬🇧 English"}
            </button>
            <button
              onClick={() => setCurrency(currency === "AWG" ? "USD" : "AWG")}
              className="flex-1 text-center py-2 text-sm text-gray-500 font-medium border border-gray-200 rounded-lg"
            >
              {currency === "AWG" ? "$ USD" : "ƒ AWG"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
