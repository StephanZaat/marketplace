import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "../contexts/LanguageContext";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="bg-ocean-900 text-ocean-300 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-sm">
              <span className="text-white">Marketplace</span><span className="text-sand-400">.aw</span>
            </span>
            <span className="text-xs text-ocean-400">{t.arubaMarketplace}</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-xs text-ocean-400">
            <Link to="/contact" className="hover:text-ocean-200 transition-colors">{t.contactUs}</Link>
            <span className="text-ocean-600">© {new Date().getFullYear()} Marketplace.aw</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
