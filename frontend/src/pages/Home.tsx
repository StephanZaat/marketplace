import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, MessageCircle, TrendingUp,
  Tag, ChevronRight, ChevronDown, Zap, Users, ArrowUpDown,
} from "lucide-react";
import api, { Listing, CategoryTree, catName } from "../api";
import ListingCard from "../components/ListingCard";
import SEO from "../components/SEO";
import { useLang } from "../contexts/LanguageContext";
import { getCategoryIcon } from "../lib/categoryIcons";

const CATS_INITIAL = 14;

function CatIcon({ name }: { name: string | null }) {
  const Icon = getCategoryIcon(name);
  return <Icon className="w-6 h-6" />;
}

export default function Home() {
  const { t, lang } = useLang();
  const [popularListings, setPopularListings] = useState<Listing[]>([]);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [tree, setTree] = useState<CategoryTree[]>([]);
  const [showAllCats, setShowAllCats] = useState(false);
  const [catSort, setCatSort] = useState<"popular" | "alpha">("popular");
  const [stats, setStats] = useState<{ active_listings: number; active_sellers: number } | null>(null);

  useEffect(() => {
    api.get<Listing[]>("/listings?limit=8&sort_by=views&sort_dir=desc").then((r) => setPopularListings(r.data)).catch(() => {});
    api.get<Listing[]>("/listings?limit=8&sort_by=date&sort_dir=desc").then((r) => setRecentListings(r.data)).catch(() => {});
    api.get<CategoryTree[]>("/categories/tree").then((r) => setTree(r.data)).catch(() => {});
    api.get<{ active_listings: number; active_sellers: number }>("/listings/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const sortedTree = catSort === "popular"
    ? [...tree].sort((a, b) => b.listing_count - a.listing_count)
    : [...tree].sort((a, b) => a.name.localeCompare(b.name));
  const visibleCats = showAllCats ? sortedTree : sortedTree.slice(0, CATS_INITIAL);

  const localBusinessLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Marketplace.aw",
    url: "https://marketplace.aw",
    description: "Aruba's local marketplace. Buy and sell anything on the island — no fees, no fuss.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://marketplace.aw/listings?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="bg-white">
      <SEO jsonLd={localBusinessLd} />
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[420px] flex items-center">
        {/* Background photo */}
        <picture>
          <source srcSet="/aruba-hero.webp" type="image/webp" />
          <img
            src="/aruba-hero.jpg"
            alt="Aruba beach"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        </picture>
        {/* Dark gradient overlay — stronger at top/bottom, lighter in centre */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/65" />

        <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5 text-sand-300" />
            {t.heroBadge}
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-3 leading-tight tracking-tight drop-shadow-lg">
            {t.heroTitle}<span className="text-sand-300">.aw</span>
          </h1>
          <p className="text-white/85 text-base md:text-lg mb-7 max-w-xl mx-auto leading-relaxed drop-shadow whitespace-pre-line">
            {t.heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
            <Link to="/listings/new" className="px-8 py-3 bg-sand-400 hover:bg-sand-300 text-gray-900 font-bold text-sm rounded-xl transition-colors shadow-lg">
              {t.postListing}
            </Link>
            <Link to="/listings" className="px-8 py-3 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold text-sm rounded-xl transition-colors backdrop-blur-sm">
              {t.browseListings}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <section className="bg-ocean-800 text-white">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 divide-x divide-ocean-700">
          {[
            { icon: Tag,   value: stats ? (stats.active_listings > 0 ? `${stats.active_listings}+` : "–") : "…", label: t.activeListings },
            { icon: Users, value: stats ? (stats.active_sellers > 0 ? `${stats.active_sellers}+` : "–") : "…", label: t.registeredSellers },
            { icon: Zap,   value: t.free,  label: t.zeroFees },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-4 text-center sm:text-left">
              <div className="w-7 h-7 rounded-full bg-ocean-700 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-sand-300" />
              </div>
              <div>
                <div className="font-bold text-base text-white">{value}</div>
                <div className="text-ocean-300 text-xs">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────────────── */}
      <section className="bg-ocean-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{t.shopByCategory}</h2>
              <button
                onClick={() => setCatSort(s => s === "popular" ? "alpha" : "popular")}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-ocean-600 transition-colors"
                title={catSort === "popular" ? "Switch to alphabetical" : "Switch to most popular"}
              >
                <ArrowUpDown className="w-3 h-3" />
                {catSort === "popular" ? "Popular" : "A–Z"}
              </button>
            </div>
            <Link to="/listings" className="hidden sm:flex items-center gap-1 text-ocean-600 hover:text-ocean-800 text-sm font-medium transition-colors">
              {t.viewAll} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {visibleCats.map((cat) => (
              <Link
                key={cat.id}
                to={`/listings?category=${cat.slug}`}
                className="group flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white hover:bg-white border border-transparent hover:border-ocean-200 transition-all hover:shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-ocean-100 text-ocean-600 flex items-center justify-center group-hover:bg-ocean-600 group-hover:text-white transition-all group-hover:scale-110">
                  <CatIcon name={cat.icon} />
                </div>
                <span className="text-xs font-medium text-gray-600 group-hover:text-ocean-700 text-center leading-tight transition-colors">
                  {catName(cat, lang)}
                </span>
                {cat.listing_count > 0 && (
                  <span className="text-[10px] text-gray-400">{cat.listing_count}</span>
                )}
              </Link>
            ))}
          </div>
          {tree.length > CATS_INITIAL && (
            <div className="text-center mt-3">
              <button
                onClick={() => setShowAllCats(!showAllCats)}
                className="inline-flex items-center gap-1.5 text-sm text-ocean-600 hover:text-ocean-800 font-medium transition-colors"
              >
                {showAllCats ? (
                  <>{t.showLess} <ChevronDown className="w-4 h-4 rotate-180" /></>
                ) : (
                  <>{t.showAllCategories.replace("{n}", String(tree.length))} <ChevronDown className="w-4 h-4" /></>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Recently Added ───────────────────────────────────────────────────── */}
      {recentListings.length > 0 && (
        <section className="bg-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t.recentlyAdded}</h2>
              <Link to="/listings?sort_by=date&sort_dir=desc" className="flex items-center gap-1 text-ocean-600 hover:text-ocean-800 text-sm font-medium transition-colors">
                {t.viewAll} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentListings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Most Popular ─────────────────────────────────────────────────────── */}
      <section className="bg-ocean-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{t.mostPopular}</h2>
            <Link to="/listings?sort_by=views&sort_dir=desc" className="flex items-center gap-1 text-ocean-600 hover:text-ocean-800 text-sm font-medium transition-colors">
              {t.viewAll} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {popularListings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {popularListings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-4">🏄</div>
              <p className="text-lg font-medium mb-1">{t.noListingsYet}</p>
              <p className="text-sm mb-6">{t.beFirstToSell}</p>
              <Link to="/listings/new" className="btn-primary">{t.postListing}</Link>
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="bg-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-6">{t.howItWorks}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[calc(16%+1.5rem)] right-[calc(16%+1.5rem)] h-0.5 bg-gradient-to-r from-ocean-200 via-ocean-300 to-ocean-200" />

            {[
              {
                icon: <ShieldCheck className="w-7 h-7" />,
                step: "01",
                title: t.step1Title,
                desc: t.step1Desc,
              },
              {
                icon: <TrendingUp className="w-7 h-7" />,
                step: "02",
                title: t.step2Title,
                desc: t.step2Desc,
              },
              {
                icon: <MessageCircle className="w-7 h-7" />,
                step: "03",
                title: t.step3Title,
                desc: t.step3Desc,
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center relative">
                <div className="w-14 h-14 rounded-xl bg-ocean-600 text-white flex items-center justify-center mb-3 shadow-md relative z-10">
                  {s.icon}
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-sand-400 text-gray-900 text-xs font-bold flex items-center justify-center">
                    {s.step}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{s.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed max-w-xs">{s.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>
    </div>
  );
}
