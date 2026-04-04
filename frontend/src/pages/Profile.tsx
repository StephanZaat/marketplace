import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Calendar, Edit, Heart, CheckCircle, Phone, Clock, Bell, ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api, { User, Listing, CategoryTree, PendingRating, UserRatingStats, catName } from "../api";
import ListingCard from "../components/ListingCard";
import LocationMap from "../components/LocationMap";
import StarDisplay from "../components/StarDisplay";
import RatingModal from "../components/RatingModal";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";

type Tab = "listings" | "sold" | "expired" | "favorites" | "alerts";

// ── Category alert tree ──────────────────────────────────────────────────────

function AlertCategoryNode({
  node,
  selected,
  onToggle,
  lang,
  depth,
  sort,
}: {
  node: CategoryTree;
  selected: Set<string>;
  onToggle: (id: string, hasChildren: boolean, childIds: string[]) => void;
  lang: string;
  depth: number;
  sort: "popular" | "az";
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  const collectDescendants = (n: CategoryTree): string[] => {
    const ids: string[] = [];
    for (const c of n.children) {
      ids.push(c.id);
      ids.push(...collectDescendants(c));
    }
    return ids;
  };
  const descendantIds = collectDescendants(node);

  const isChecked = selected.has(node.id);
  const someChildChecked = descendantIds.some((id) => selected.has(id));

  const sortedChildren = [...node.children].sort((a, b) =>
    sort === "popular"
      ? b.listing_count - a.listing_count
      : catName(a, lang).localeCompare(catName(b, lang))
  );

  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <div className="flex items-center gap-2 py-1.5 group">
        {hasChildren ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggle(node.id, hasChildren, descendantIds)}
            className="w-4 h-4 rounded text-ocean-600 accent-ocean-600"
          />
          <span className={`text-sm ${depth === 0 ? "font-semibold text-gray-800" : "text-gray-700"}`}>
            {catName(node, lang)}
          </span>
          {node.listing_count > 0 && (
            <span className="text-xs text-gray-400">{node.listing_count}</span>
          )}
          {someChildChecked && !isChecked && (
            <span className="w-2 h-2 rounded-full bg-ocean-400 shrink-0" title="Some subcategories selected" />
          )}
        </label>
      </div>
      {hasChildren && open && (
        <div>
          {sortedChildren.map((child) => (
            <AlertCategoryNode
              key={child.id}
              node={child}
              selected={selected}
              onToggle={onToggle}
              lang={lang}
              depth={depth + 1}
              sort={sort}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: me } = useAuth();
  const { t, lang } = useLang();
  const [profile, setProfile] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [soldListings, setSoldListings] = useState<Listing[]>([]);
  const [expiredListings, setExpiredListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [tab, setTab] = useState<Tab>("listings");
  const [loading, setLoading] = useState(true);

  // Category alerts
  const [catTree, setCatTree] = useState<CategoryTree[]>([]);
  const [alertSelected, setAlertSelected] = useState<Set<string>>(new Set());
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertSort, setAlertSort] = useState<"popular" | "az">("popular");

  // Ratings
  const [ratingStats, setRatingStats] = useState<UserRatingStats | null>(null);
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);

  const isMe = me?.id === userId;

  // Load category tree + current alert subscriptions when viewing own profile
  useEffect(() => {
    if (!isMe) return;
    api.get<CategoryTree[]>("/categories/tree").then((r) => setCatTree(r.data)).catch(() => {});
    api.get<string[]>("/alerts/categories").then((r) => setAlertSelected(new Set(r.data))).catch(() => {});
    api.get<PendingRating[]>("/ratings/pending").then((r) => setPendingRatings(r.data)).catch(() => {});
  }, [isMe]);

  // Load rating stats for any profile
  useEffect(() => {
    if (!userId) return;
    api.get<UserRatingStats>(`/ratings/user/${userId}`).then((r) => setRatingStats(r.data)).catch(() => {});
  }, [userId]);

  const handleAlertToggle = useCallback((id: string, hasChildren: boolean, descendantIds: string[]) => {
    setAlertSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Uncheck: remove this node and all descendants
        next.delete(id);
        if (hasChildren) descendantIds.forEach((d) => next.delete(d));
      } else {
        // Check: add only this node (not auto-select children — user controls each)
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAlertSave = async () => {
    setAlertSaving(true);
    try {
      await api.put("/alerts/categories", Array.from(alertSelected));
      toast.success(t.alertsSaved);
    } catch {
      toast.error(t.alertsSaveFailed);
    } finally {
      setAlertSaving(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    api.get<User>(`/users/${userId}`)
      .then((userRes) => {
        setProfile(userRes.data);
        const uid = userRes.data.id;
        return Promise.all([
          api.get<Listing[]>(`/listings?seller_id=${uid}&limit=100`),
          isMe
            ? api.get<Listing[]>(`/listings?seller_id=${uid}&status=sold&limit=100`)
            : Promise.resolve({ data: [] as Listing[] }),
          isMe
            ? api.get<Listing[]>(`/listings?seller_id=${uid}&status=expired&limit=100`)
            : Promise.resolve({ data: [] as Listing[] }),
          isMe
            ? api.get<Listing[]>("/favorites")
            : Promise.resolve({ data: [] as Listing[] }),
        ]);
      })
      .then(([listRes, soldRes, expiredRes, favRes]) => {
        setListings(listRes.data);
        setSoldListings(soldRes.data);
        setExpiredListings(expiredRes.data);
        setFavorites(favRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, isMe]);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="max-w-5xl mx-auto px-4 py-20 text-center text-gray-400">User not found</div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Rating modal — shown one at a time */}
      {pendingRatings.length > 0 && (
        <RatingModal
          pending={pendingRatings[0]}
          onDismiss={() => setPendingRatings((prev) => prev.slice(1))}
          onSubmitted={() => {
            setPendingRatings((prev) => prev.slice(1));
            // Refresh stats after submitting
            api.get<UserRatingStats>(`/ratings/user/${userId}`).then((r) => setRatingStats(r.data)).catch(() => {});
          }}
        />
      )}

      {/* Profile header */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-center sm:items-start gap-3 sm:gap-5">
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name ?? "Profile"} className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center text-2xl sm:text-3xl font-bold">
                {(profile.full_name ?? "?")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 break-words min-w-0">{profile.full_name ?? "Unknown"}</h1>
              {isMe && (
                <Link to="/settings" className="btn-secondary text-sm gap-1.5 shrink-0 whitespace-nowrap hidden sm:inline-flex">
                  <Edit className="w-3.5 h-3.5" /> {t.editProfile}
                </Link>
              )}
            </div>
            {/* Seller rating summary */}
            {ratingStats && ratingStats.as_seller.count > 0 && (
              <div className="mt-1">
                {ratingStats.as_seller.avg_overall != null && (
                  <StarDisplay
                    rating={ratingStats.as_seller.avg_overall}
                    count={ratingStats.as_seller.count}
                    size="sm"
                  />
                )}
              </div>
            )}
            {profile.languages && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {profile.languages.split(",").map(l => l.trim()).filter(Boolean).map(lang => {
                  const langMeta: Record<string, { flag: string; label: string }> = {
                    english:    { flag: "🇬🇧", label: t.langEnglish },
                    spanish:    { flag: "🇪🇸", label: t.langSpanish },
                    papiamento: { flag: "🇦🇼", label: t.langPapiamento },
                    dutch:      { flag: "🇳🇱", label: t.langDutch },
                  };
                  const meta = langMeta[lang];
                  return meta ? (
                    <span key={lang} title={meta.label} className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                      <span>{meta.flag}</span>
                      <span>{meta.label}</span>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 sm:mt-3 text-xs text-gray-400">
              {profile.location && (
                <LocationMap location={profile.location} className="text-xs text-gray-400" />
              )}
              {profile.phone && profile.contact_method?.split(",").map(s => s.trim()).includes("phone") && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {profile.phone}
                </a>
              )}
              {profile.whatsapp && profile.contact_method?.split(",").map(s => s.trim()).includes("whatsapp") && (
                <a
                  href={`https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-green-600 hover:text-green-700"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.571a.75.75 0 00.943.878l5.919-1.953A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.614-.498-5.13-1.373l-.368-.217-3.814 1.259 1.198-3.698-.237-.381A9.943 9.943 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  {profile.whatsapp}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t.joined} {format(new Date(profile.created_at), "MMMM yyyy")}
              </span>
            </div>
          </div>
        </div>
        {isMe && (
          <Link to="/settings" className="btn-secondary text-sm gap-1.5 w-full justify-center mt-3 sm:hidden">
            <Edit className="w-3.5 h-3.5" /> {t.editProfile}
          </Link>
        )}
      </div>

      {/* Rating breakdown — only show on profile page when there are ratings */}
      {ratingStats && ratingStats.as_seller.count > 0 && (
        <div className="card p-3 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-500 font-medium shrink-0">{t.sellerRatings} ({ratingStats.as_seller.count})</span>
            {([
              { label: t.ratingDescription, avg: ratingStats.as_seller.avg_description },
              { label: t.ratingCommunication, avg: ratingStats.as_seller.avg_communication },
              { label: t.ratingExchange, avg: ratingStats.as_seller.avg_exchange },
            ] as { label: string; avg: number | null }[]).map(({ label, avg }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="text-xs text-gray-400">{label}</span>
                {avg != null && <StarDisplay rating={avg} size="sm" showCount={false} />}
                <span className="text-xs font-semibold text-gray-700">{avg?.toFixed(1) ?? "–"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab("listings")}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center justify-center sm:justify-start gap-1.5 ${tab === "listings" ? "border-ocean-600 text-ocean-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <LayoutGrid className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">{t.listings}</span>
          <span className="text-xs text-gray-400">({listings.length})</span>
        </button>
        {isMe && (
          <button
            onClick={() => setTab("sold")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center justify-center sm:justify-start gap-1.5 ${tab === "sold" ? "border-ocean-600 text-ocean-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <CheckCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t.sold}</span>
            <span className="text-xs text-gray-400">({soldListings.length})</span>
          </button>
        )}
        {isMe && (
          <button
            onClick={() => setTab("expired")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center justify-center sm:justify-start gap-1.5 ${tab === "expired" ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Clock className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t.statusExpired}</span>
            {expiredListings.length > 0 && (
              <span className="text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-medium">
                {expiredListings.length}
              </span>
            )}
          </button>
        )}
        {isMe && (
          <button
            onClick={() => setTab("favorites")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center justify-center sm:justify-start gap-1.5 ${tab === "favorites" ? "border-ocean-600 text-ocean-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Heart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t.favorites}</span>
            <span className="text-xs text-gray-400">({favorites.length})</span>
          </button>
        )}
        {isMe && (
          <button
            onClick={() => setTab("alerts")}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center justify-center sm:justify-start gap-1.5 ${tab === "alerts" ? "border-ocean-600 text-ocean-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Bell className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t.alerts}</span>
            {alertSelected.size > 0 && (
              <span className="text-xs bg-ocean-100 text-ocean-600 rounded-full px-1.5 py-0.5 font-medium">
                {alertSelected.size}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {tab === "listings" && (
        listings.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <div className="card p-10 text-center text-gray-400">
            <p>{t.noListings}</p>
            {isMe && <Link to="/listings/new" className="btn-primary mt-4 inline-flex">{t.listFirstItem}</Link>}
          </div>
        )
      )}

      {tab === "sold" && (
        soldListings.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {soldListings.map((l) => (
              <div key={l.id} className="relative group">
                <ListingCard listing={l} />
                <div className="mt-1">
                  <button
                    onClick={async () => {
                      try {
                        await api.patch(`/listings/${l.id}`, { status: "active" });
                        setSoldListings((prev) => prev.filter((x) => x.id !== l.id));
                        setListings((prev) => [{ ...l, status: "active" }, ...prev]);
                      } catch {
                        // silently ignore
                      }
                    }}
                    className="w-full text-xs text-ocean-600 hover:text-ocean-800 hover:bg-ocean-50 border border-ocean-200 rounded-lg py-1.5 transition-colors"
                  >
                    {t.relist}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>{t.noSoldItems}</p>
          </div>
        )
      )}

      {tab === "expired" && (
        expiredListings.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t.expiredTabHint}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {expiredListings.map((l) => (
                <div key={l.id}>
                  <ListingCard listing={l} />
                  <button
                    onClick={async () => {
                      try {
                        await api.post(`/listings/${l.id}/renew`);
                        setExpiredListings((prev) => prev.filter((x) => x.id !== l.id));
                        setListings((prev) => [{ ...l, status: "active" }, ...prev]);
                      } catch {
                        // silently ignore
                      }
                    }}
                    className="mt-1 w-full text-xs text-ocean-600 hover:text-ocean-800 hover:bg-ocean-50 border border-ocean-200 rounded-lg py-1.5 transition-colors"
                  >
                    {t.renewListing}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>{t.noExpiredListings}</p>
          </div>
        )
      )}

      {tab === "favorites" && (
        favorites.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {favorites.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <div className="card p-10 text-center text-gray-400">
            <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>{t.noFavorites}</p>
            <p className="text-sm mt-1">{t.heartToSave}</p>
          </div>
        )
      )}

      {tab === "alerts" && (
        <div className="card p-6 max-w-lg">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-ocean-500" />
              <h2 className="font-semibold text-gray-900">{t.alertsTitle}</h2>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <button
                onClick={() => setAlertSort("popular")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${alertSort === "popular" ? "bg-ocean-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                title={t.sortPopular}
              >
                {t.sortPopular}
              </button>
              <button
                onClick={() => setAlertSort("az")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${alertSort === "az" ? "bg-ocean-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                title="A–Z"
              >
                A–Z
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-5">{t.alertsHint}</p>

          {catTree.length === 0 ? (
            <div className="text-sm text-gray-400">{t.loading}</div>
          ) : (
            <div className="space-y-1 mb-6 max-h-96 overflow-y-auto pr-1">
              {[...catTree]
                .sort((a, b) => alertSort === "popular"
                  ? b.listing_count - a.listing_count
                  : catName(a, lang).localeCompare(catName(b, lang)))
                .map((node) => (
                  <AlertCategoryNode
                    key={node.id}
                    node={node}
                    selected={alertSelected}
                    onToggle={handleAlertToggle}
                    lang={lang}
                    depth={0}
                    sort={alertSort}
                  />
                ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {alertSelected.size === 0
                  ? t.alertsNoneSelected
                  : t.alertsCount.replace("{n}", String(alertSelected.size))}
              </span>
              {alertSelected.size > 0 && (
                <button
                  onClick={() => setAlertSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  {t.alertsClearAll}
                </button>
              )}
            </div>
            <button
              onClick={handleAlertSave}
              disabled={alertSaving}
              className="btn-primary gap-2"
            >
              <Bell className="w-4 h-4" />
              {alertSaving ? t.saving : t.saveAlerts}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
