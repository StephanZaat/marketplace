import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useParams, useNavigate, Link } from "react-router-dom";
import { X, ArrowUp, ArrowDown, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import api, { Listing, CategoryTree, CategoryAttrField, catName } from "../api";
import ListingCard from "../components/ListingCard";
import CategoryTreeNav from "../components/CategoryTree";
import { ARUBA_AREAS } from "../lib/arubaAreas";
import { useLang } from "../contexts/LanguageContext";
import SEO from "../components/SEO";

const CONDITION_VALUES = ["new", "like_new", "good", "fair", "poor"] as const;
const SORT_KEYS = [
  { key: "date",  labelKey: "sortDate" as const,    defaultDir: "desc" },
  { key: "price", labelKey: "sortPrice" as const,   defaultDir: "asc" },
  { key: "views", labelKey: "sortPopular" as const, defaultDir: "desc" },
] as const;

const PAGE_SIZE = 24; // 6 rows × 4 cols

export default function Listings() {
  const { t, lang } = useLang();
  const CONDITIONS = [
    { value: "new", label: t.condNew },
    { value: "like_new", label: t.condLikeNew },
    { value: "good", label: t.condGood },
    { value: "fair", label: t.condFair },
    { value: "poor", label: t.condPoor },
  ];
  const SORT_BUTTONS = SORT_KEYS.map(s => ({ ...s, label: t[s.labelKey] }));
  const [params, setParams] = useSearchParams();
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [tree, setTree] = useState<CategoryTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchCounts, setSearchCounts] = useState<Record<string, number> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  const q         = params.get("q") ?? "";
  // Category can come from either the /c/:slug route or the legacy ?category= query param.
  // The route param takes precedence; the legacy query param gets redirected below.
  const category  = routeSlug ?? params.get("category") ?? "";

  // Redirect legacy /listings?category=slug → /c/slug (preserves other query params).
  useEffect(() => {
    const legacy = params.get("category");
    if (legacy && !routeSlug) {
      const p = new URLSearchParams(params);
      p.delete("category");
      const qs = p.toString();
      navigate(`/c/${legacy}${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [params, routeSlug, navigate]);
  const condition = params.get("condition") ?? "";
  const minPrice  = params.get("min_price") ?? "";
  const maxPrice  = params.get("max_price") ?? "";
  const location  = params.get("location") ?? "";
  const free      = params.get("free") === "1";
  const sort      = params.get("sort") ?? "date-desc";

  const [sortBy, sortDir] = sort.split("-") as [string, string];

  useEffect(() => {
    api.get<CategoryTree[]>("/categories/tree").then((r) => setTree(r.data)).catch(() => {});
  }, []);

  // Scroll selected category into view in the sidebar after tree renders
  useEffect(() => {
    if (!category || !sidebarScrollRef.current) return;
    requestAnimationFrame(() => {
      const btn = sidebarScrollRef.current?.querySelector<HTMLElement>(`[data-slug="${category}"]`);
      btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [category, tree]);

  const buildParams = useCallback((skip: number) => {
    const p = new URLSearchParams();
    if (q)         p.set("q", q);
    if (category)  p.set("category", category);
    if (condition) p.set("condition", condition);
    if (free) {
      p.set("min_price", "0");
      p.set("max_price", "0");
    } else {
      if (minPrice)  p.set("min_price", minPrice);
      if (maxPrice)  p.set("max_price", maxPrice);
    }
    if (location)  p.set("location", location);
    // Include active attribute filters
    params.forEach((v, k) => { if (k.startsWith("attr_") && v) p.set(k, v); });
    p.set("sort_by", sortBy);
    p.set("sort_dir", sortDir);
    p.set("skip", String(skip));
    p.set("limit", String(PAGE_SIZE));
    return p;
  }, [q, category, condition, minPrice, maxPrice, location, free, sortBy, sortDir, params]);

  // Fetch per-category counts when search/filters are active
  useEffect(() => {
    const hasFilter = q || condition || minPrice || maxPrice || location || free;
    if (!hasFilter) { setSearchCounts(null); return; }
    const p = new URLSearchParams();
    if (q)         p.set("q", q);
    if (condition) p.set("condition", condition);
    if (free) { p.set("min_price", "0"); p.set("max_price", "0"); }
    else {
      if (minPrice) p.set("min_price", minPrice);
      if (maxPrice) p.set("max_price", maxPrice);
    }
    if (location)  p.set("location", location);
    api.get<Record<string, number>>(`/listings/category-counts?${p}`).then(r => setSearchCounts(r.data)).catch(() => {});
  }, [q, condition, minPrice, maxPrice, location, free]);

  // Initial load — reset list; abort previous in-flight request on param change
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListings([]);
    setHasMore(false);
    setTotal(null);
    api.get<Listing[]>(`/listings?${buildParams(0)}`, { signal: controller.signal }).then((r) => {
      setListings(r.data);
      setHasMore(r.data.length === PAGE_SIZE);
      setTotal(null);
      setLoading(false);
    }).catch((e) => {
      if (e?.code !== "ERR_CANCELED") {
        console.error(e);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [buildParams]);

  // Infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true);
          api.get<Listing[]>(`/listings?${buildParams(listings.length)}`).then((r) => {
            setListings((prev) => [...prev, ...r.data]);
            setHasMore(r.data.length === PAGE_SIZE);
          }).catch(() => {}).finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, listings.length, buildParams]);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value); else p.delete(key);
    setParams(p);
  };

  // Category changes navigate to /c/:slug (or /listings for "all"), preserving other filters.
  // Attribute filters are dropped since they're category-specific.
  const navigateToCategory = (slug: string) => {
    const p = new URLSearchParams(params);
    Array.from(p.keys())
      .filter((k) => k.startsWith("attr_"))
      .forEach((k) => p.delete(k));
    const qs = p.toString();
    const suffix = qs ? `?${qs}` : "";
    navigate(slug ? `/c/${slug}${suffix}` : `/listings${suffix}`);
  };

  const handleSortButton = (key: string, defaultDir: string) => {
    const p = new URLSearchParams(params);
    if (sortBy === key) {
      p.set("sort", `${key}-${sortDir === "asc" ? "desc" : "asc"}`);
    } else {
      p.set("sort", `${key}-${defaultDir}`);
    }
    setParams(p);
  };

  const clearFilters = () => {
    // Preserve search query and sort; drop condition/price/location/free and all attr_* filters.
    // Category stays because it lives in the route path, not the query string.
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sort && sort !== "date-desc") p.set("sort", sort);
    setParams(p);
  };

  // Attribute filter values: attr_<key> params
  const attrParams: Record<string, string> = {};
  params.forEach((v, k) => { if (k.startsWith("attr_")) attrParams[k.slice(5)] = v; });
  const hasAttrFilters = Object.keys(attrParams).length > 0;

  const hasFilters = condition || minPrice || maxPrice || location || free || hasAttrFilters;

  // Find the breadcrumb path for the selected category: [root, ..., leaf]
  const findPath = (nodes: CategoryTree[], slug: string, path: CategoryTree[] = []): CategoryTree[] | null => {
    for (const n of nodes) {
      const current = [...path, n];
      if (n.slug === slug) return current;
      const found = findPath(n.children, slug, current);
      if (found) return found;
    }
    return null;
  };

  const categoryPath = category ? findPath(tree, category) : null;
  const categoryName = categoryPath ? (() => { const n = categoryPath[categoryPath.length - 1]; return n ? catName(n, lang) : null; })() : null;
  // Walk up the category hierarchy to find the first node that has attributes defined
  // (attributes may be on a parent category, e.g. "Cars", not the leaf "Unleaded Cars")
  const attrFields: CategoryAttrField[] = (() => {
    for (const node of [...(categoryPath ?? [])].reverse()) {
      const fields = node.attributes.filter(a => a.type === "select" && (a.options?.length ?? 0) > 0);
      if (fields.length > 0) return fields;
    }
    return [];
  })();

  // Collect listing_count for each node (including children rollup) keyed by slug
  const countBySlug = useCallback((nodes: CategoryTree[]): Record<string, number> => {
    const map: Record<string, number> = {};
    const visit = (n: CategoryTree) => {
      map[n.slug] = n.listing_count;
      n.children.forEach(visit);
    };
    nodes.forEach(visit);
    return map;
  }, []);
  const slugCounts = searchCounts ?? countBySlug(tree);

  const catLabel = categoryName || category;
  const seoTitle = q
    ? `"${q}" for sale in Aruba`
    : catLabel
      ? `${catLabel} for Sale in Aruba — Buy & Sell on Marketplace.aw`
      : "Buy & Sell in Aruba — Marketplace.aw";
  const seoDesc = q
    ? `Search results for "${q}" on Marketplace.aw. Find great deals in Aruba.`
    : catLabel
      ? `Browse ${catLabel} for sale in Aruba. New and second-hand — no fees, local deals on Marketplace.aw.`
      : "Browse all listings for sale in Aruba. No fees, just great local deals on Marketplace.aw.";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5" onClick={() => openFilter && setOpenFilter(null)}>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={routeSlug ? `/c/${routeSlug}` : "/listings"}
      />
      {/* Page heading */}
      <div className="mb-4">
        {/* Breadcrumb for subcategories */}
        {categoryPath && categoryPath.length > 1 && (
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-1">
            <button
              type="button"
              onClick={() => navigateToCategory("")}
              className="hover:text-ocean-600 transition-colors"
            >
              {t.allListings}
            </button>
            {categoryPath.slice(0, -1).map((crumb) => (
              <React.Fragment key={crumb.slug}>
                <span className="text-gray-300">/</span>
                <button
                  type="button"
                  onClick={() => navigateToCategory(crumb.slug)}
                  className="hover:text-ocean-600 transition-colors"
                >
                  {catName(crumb, lang)}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {q ? t.resultsFor.replace("{q}", q) : categoryName ?? t.allListings}
          </h1>
          {q && (
            <button
              type="button"
              onClick={() => setParam("q", "")}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full px-2.5 py-0.5 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          {!loading && (
            <span className="text-sm text-gray-400">
              {listings.length !== 1
                ? t.itemsPlural.replace("{n}", String(listings.length) + (hasMore ? "+" : ""))
                : t.items.replace("{n}", String(listings.length))}
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
        {/* Sort buttons — always visible */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-400 font-medium mr-1 hidden sm:inline">{t.sortLabel}</span>
          {SORT_BUTTONS.map(({ key, label, defaultDir }) => {
            const active = sortBy === key;
            const Dir = sortDir === "asc" ? ArrowUp : ArrowDown;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSortButton(key, defaultDir)}
                className={`flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg border transition-colors ${
                  active
                    ? "border-ocean-400 bg-ocean-50 text-ocean-700 font-medium"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {label}
                {active
                  ? <Dir className="w-3.5 h-3.5" />
                  : <ArrowDown className="w-3.5 h-3.5 text-gray-300" />
                }
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        {/* Mobile: Filters pill */}
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className={`sm:hidden flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            hasFilters ? "border-ocean-400 bg-ocean-50 text-ocean-700" : "border-gray-200 bg-white text-gray-600"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasFilters && (
            <span className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-ocean-500 text-white text-[10px] font-bold leading-none">
              {[condition, location, minPrice || maxPrice || free ? "1" : "", ...Object.values(attrParams)].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Desktop: inline filter dropdowns */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap flex-1" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs text-gray-400 font-medium mr-1 shrink-0">{t.filterLabel}</span>
          {/* Location dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenFilter(openFilter === "location" ? null : "location")}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg border transition-colors ${
                location ? "border-ocean-400 bg-ocean-50 text-ocean-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {location || t.filterLocation}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openFilter === "location" && (
              <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-500"
                  onClick={() => { setParam("location", ""); setOpenFilter(null); }}
                >
                  {t.anyLocation}
                </button>
                {ARUBA_AREAS.map((area) => (
                  <button
                    key={area}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-ocean-50 hover:text-ocean-700 ${location === area ? "bg-ocean-50 text-ocean-700 font-medium" : "text-gray-700"}`}
                    onClick={() => { setParam("location", area); setOpenFilter(null); }}
                  >
                    {area}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Condition dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenFilter(openFilter === "condition" ? null : "condition")}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg border transition-colors ${
                condition ? "border-ocean-400 bg-ocean-50 text-ocean-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {condition ? CONDITIONS.find(c => c.value === condition)?.label : t.filterCondition}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openFilter === "condition" && (
              <div className="absolute top-full left-0 mt-1 z-30 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                <button
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-500"
                  onClick={() => { setParam("condition", ""); setOpenFilter(null); }}
                >
                  {t.anyCondition}
                </button>
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-ocean-50 hover:text-ocean-700 ${condition === c.value ? "bg-ocean-50 text-ocean-700 font-medium" : "text-gray-700"}`}
                    onClick={() => { setParam("condition", c.value); setOpenFilter(null); }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenFilter(openFilter === "price" ? null : "price")}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg border transition-colors ${
                (minPrice || maxPrice || free) ? "border-ocean-400 bg-ocean-50 text-ocean-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {free ? t.free : (minPrice || maxPrice) ? `ƒ${minPrice || "0"} – ${maxPrice ? "ƒ" + maxPrice : "∞"}` : t.filterPrice}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {openFilter === "price" && (
              <div className="absolute top-full left-0 mt-1 z-30 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3" onClick={(e) => e.stopPropagation()}>
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-3 pb-2 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={free}
                    onChange={(e) => {
                      const p = new URLSearchParams(params);
                      if (e.target.checked) { p.set("free", "1"); p.delete("min_price"); p.delete("max_price"); }
                      else p.delete("free");
                      setParams(p);
                    }}
                    className="rounded"
                  />
                  <span className="font-medium text-green-600">{t.freeItemsOnly}</span>
                </label>
                {!free && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t.priceRange}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          const v = digits === "" ? "" : String(Math.min(999999, Number(digits)));
                          setParam("min_price", v);
                        }}
                        className="input text-sm w-full"
                      />
                      <span className="text-gray-400 shrink-0">–</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          const v = digits === "" ? "" : String(Math.min(999999, Number(digits)));
                          setParam("max_price", v);
                        }}
                        className="input text-sm w-full"
                      />
                    </div>
                    {minPrice && maxPrice && Number(minPrice) >= Number(maxPrice) && (
                      <p className="text-xs text-red-500">Min must be less than max</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attribute filters */}
          {attrFields.map((field) => {
            const current = attrParams[field.key] ?? "";
            const fieldLabel = (lang === "es" && field.label_es) ? field.label_es : field.label;
            const translateOpt = (opt: string) => {
              if (lang !== "es" || !field.options_es) return opt;
              const idx = field.options?.indexOf(opt) ?? -1;
              return (idx !== -1 && field.options_es[idx]) ? field.options_es[idx] : opt;
            };
            return (
              <div key={field.key} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter(openFilter === `attr_${field.key}` ? null : `attr_${field.key}`)}
                  className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg border transition-colors ${
                    current ? "border-ocean-400 bg-ocean-50 text-ocean-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {current ? `${fieldLabel}: ${translateOpt(current)}` : fieldLabel}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openFilter === `attr_${field.key}` && (
                  <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-60 overflow-y-auto">
                    <button
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-500"
                      onClick={() => { setParam(`attr_${field.key}`, ""); setOpenFilter(null); }}
                    >
                      {lang === "es" ? `Cualquier ${fieldLabel.toLowerCase()}` : `Any ${fieldLabel.toLowerCase()}`}
                    </button>
                    {field.options?.map((opt, i) => (
                      <button
                        key={opt}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-ocean-50 hover:text-ocean-700 ${current === opt ? "bg-ocean-50 text-ocean-700 font-medium" : "text-gray-700"}`}
                        onClick={() => { setParam(`attr_${field.key}`, opt); setOpenFilter(null); }}
                      >
                        {(lang === "es" && field.options_es?.[i]) ? field.options_es[i] : opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Clear filters */}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-ocean-600 hover:text-ocean-800 ml-auto">
              <X className="w-3.5 h-3.5" /> {t.clearFilters}
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter bottom drawer */}
      {mobileFiltersOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          {/* Sheet */}
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300 absolute top-2 left-1/2 -translate-x-1/2" />
              <h2 className="text-base font-semibold text-gray-900">Filters</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto p-4 space-y-4">
              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t.filterLocation}</label>
                <select
                  value={location}
                  onChange={(e) => setParam("location", e.target.value)}
                  className="input text-sm"
                >
                  <option value="">{t.anyLocation}</option>
                  {ARUBA_AREAS.map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t.filterCondition}</label>
                <select
                  value={condition}
                  onChange={(e) => setParam("condition", e.target.value)}
                  className="input text-sm"
                >
                  <option value="">{t.anyCondition}</option>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t.filterPrice}</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={free}
                    onChange={(e) => {
                      const p = new URLSearchParams(params);
                      if (e.target.checked) { p.set("free", "1"); p.delete("min_price"); p.delete("max_price"); }
                      else p.delete("free");
                      setParams(p);
                    }}
                    className="rounded"
                  />
                  <span className="font-medium text-green-600">{t.freeItemsOnly}</span>
                </label>
                {!free && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setParam("min_price", digits === "" ? "" : String(Math.min(999999, Number(digits))));
                      }}
                      className="input text-sm"
                    />
                    <span className="text-gray-400 shrink-0">–</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setParam("max_price", digits === "" ? "" : String(Math.min(999999, Number(digits))));
                      }}
                      className="input text-sm"
                    />
                  </div>
                )}
                {minPrice && maxPrice && Number(minPrice) >= Number(maxPrice) && (
                  <p className="text-xs text-red-500 mt-1">Min must be less than max</p>
                )}
              </div>

              {/* Attribute filters */}
              {attrFields.map((field) => {
                const current = attrParams[field.key] ?? "";
                const fieldLabel = (lang === "es" && field.label_es) ? field.label_es : field.label;
                return (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{fieldLabel}</label>
                    <select
                      value={current}
                      onChange={(e) => setParam(`attr_${field.key}`, e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">{lang === "es" ? `Cualquier ${fieldLabel.toLowerCase()}` : `Any ${fieldLabel.toLowerCase()}`}</option>
                      {field.options?.map((opt, i) => (
                        <option key={opt} value={opt}>
                          {(lang === "es" && field.options_es?.[i]) ? field.options_es[i] : opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div className="shrink-0 p-4 border-t border-gray-100 flex gap-3">
              {hasFilters && (
                <button onClick={() => { clearFilters(); setMobileFiltersOpen(false); }} className="flex-1 btn-secondary text-sm">
                  {t.clearFilters}
                </button>
              )}
              <button onClick={() => setMobileFiltersOpen(false)} className="flex-1 btn-primary text-sm">
                Show results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile category drawer */}
      <div className="md:hidden mb-3">
        <button
          type="button"
          onClick={() => setMobileCatOpen(o => !o)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
            category ? "border-ocean-400 bg-ocean-50 text-ocean-700" : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          <span>{category ? categoryName ?? t.categories : t.categories}</span>
          {mobileCatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {mobileCatOpen && (
          <div className="mt-1 card p-3 max-h-72 overflow-y-auto">
            <CategoryTreeNav
              nodes={[...tree].sort((a, b) => catName(a, lang).localeCompare(catName(b, lang)))}
              selected={category}
              onSelect={(slug) => { navigateToCategory(slug); setMobileCatOpen(false); }}
              counts={slugCounts}
            />
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Left sidebar — sticky, scrolls independently; width adapts to longest category name */}
        <aside className="min-w-[12rem] w-fit max-w-[18rem] shrink-0 hidden md:block">
          <div className="sticky top-20">
            <div className="card p-3 flex flex-col max-h-[calc(100vh-6rem)]">
              <h3 className="font-semibold text-gray-900 text-sm mb-2 shrink-0">{t.categories}</h3>
              <div ref={sidebarScrollRef} className="overflow-y-auto min-h-0 flex-1">
                <CategoryTreeNav
                  nodes={[...tree].sort((a, b) => catName(a, lang).localeCompare(catName(b, lang)))}
                  selected={category}
                  onSelect={(slug) => navigateToCategory(slug)}
                  counts={slugCounts}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-gray-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card overflow-hidden animate-pulse">
                      <div className="aspect-[4/3] bg-gray-200" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!hasMore && listings.length >= PAGE_SIZE && (
                <p className="text-center text-sm text-gray-400 py-6">{t.allListingsLoaded}</p>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">{t.noListingsFound}</p>
              <p className="text-sm mt-1">{t.tryAdjustingFilters}</p>
              <Link to={`/listings/new${category ? `?category=${category}` : ""}`} className="btn-primary mt-4 inline-flex">{t.postListing2}</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
