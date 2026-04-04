import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Eye, Calendar, ChevronLeft, ChevronRight, MessageCircle, Edit, Trash2, CheckCircle, AlertTriangle, Clock, Flag, Mail, Phone, RefreshCw, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import api, { ListingDetail as IListingDetail, PendingRating, ConversationSummary, catName } from "../api";
import RatingModal from "../components/RatingModal";
import StarDisplay from "../components/StarDisplay";

const LANG_META: Record<string, { flag: string; label: string; label_es: string }> = {
  english:    { flag: "🇬🇧", label: "English",    label_es: "Inglés" },
  spanish:    { flag: "🇪🇸", label: "Spanish",    label_es: "Español" },
  papiamento: { flag: "🇦🇼", label: "Papiamento", label_es: "Papiamento" },
  dutch:      { flag: "🇳🇱", label: "Dutch",      label_es: "Neerlandés" },
};
import { useAuth } from "../contexts/AuthContext";
import LocationMap from "../components/LocationMap";
import { useLang } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";
import SEO from "../components/SEO";

function DeleteModal({ onConfirm, onCancel, t }: { onConfirm: () => void; onCancel: () => void; t: ReturnType<typeof useLang>["t"] }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{t.deleteListing}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">{t.deleteConfirm}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-xl transition-colors">
            {t.delete}
          </button>
          <button onClick={onCancel} className="flex-1 btn-secondary">{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ listingId, onClose, t }: { listingId: string; onClose: () => void; t: ReturnType<typeof useLang>["t"] }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const reportReasons = [
    { value: "spam", label: t.reportSpam },
    { value: "offensive", label: t.reportOffensive },
    { value: "scam", label: t.reportScam },
    { value: "wrong_category", label: t.reportWrongCategory },
    { value: "already_sold", label: t.reportAlreadySold },
    { value: "other", label: t.reportOther },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    try {
      await api.post(`/reports/listings/${listingId}`, { reason, details: details || null });
      setDone(true);
    } catch {
      toast.error(t.failedToSubmitReport);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        {done ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{t.reportSubmitted}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.reportThanks}</p>
            <button onClick={onClose} className="btn-primary px-6">{t.close}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5 text-orange-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{t.reportListing2}</h2>
            </div>
            <div className="space-y-3 mb-4">
              {reportReasons.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="w-4 h-4 text-ocean-600"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
                </label>
              ))}
            </div>
            <textarea
              placeholder={t.reportAdditionalDetails}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              className="input text-sm resize-none mb-4"
            />
            <div className="flex gap-3">
              <button type="submit" disabled={!reason || submitting} className="flex-1 btn-primary">
                {submitting ? t.submitting : t.submitReport}
              </button>
              <button type="button" onClick={onClose} className="flex-1 btn-secondary">{t.cancel}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SoldToModal({
  conversations,
  onConfirm,
  onSkip,
  onCancel,
  t,
}: {
  conversations: ConversationSummary[];
  onConfirm: (conversationId: string) => void;
  onSkip: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useLang>["t"];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t.soldToTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t.soldToSubtitle}</p>
          </div>
        </div>
        <div className="space-y-1 mb-5">
          {conversations.map((c) => (
            <label key={c.conversation_id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input
                type="radio"
                name="soldTo"
                value={c.conversation_id}
                checked={selected === c.conversation_id}
                onChange={() => setSelected(c.conversation_id)}
                className="w-4 h-4 text-ocean-600"
              />
              <span className="text-sm text-gray-800 font-medium">{c.buyer_name ?? t.unknownUser}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => selected !== null && onConfirm(selected)}
            disabled={selected === null}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {t.soldToConfirm}
          </button>
          <button onClick={onSkip} className="flex-1 btn-secondary text-sm">
            {t.soldToSkip}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const { formatPrice } = useCurrency();
  const conditionLabels: Record<string, string> = {
    new: t.condNew, like_new: t.condLikeNew, good: t.condGood, fair: t.condFair, poor: t.condPoor,
  };
  const statusLabels: Record<string, string> = {
    active: t.statusAvailable, sold: t.statusSold, reserved: t.statusReserved, inactive: t.statusInactive, expired: t.statusExpired,
  };
  const navigate = useNavigate();
  const [listing, setListing] = useState<IListingDetail | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [showSoldToModal, setShowSoldToModal] = useState(false);
  const [soldToConversations, setSoldToConversations] = useState<ConversationSummary[]>([]);
  const [soldToLoading, setSoldToLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") setImgIndex(i => (i - 1 + (listing?.images.length ?? 1)) % (listing?.images.length ?? 1));
      if (e.key === "ArrowRight") setImgIndex(i => (i + 1) % (listing?.images.length ?? 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, listing?.images.length]);

  useEffect(() => {
    const viewedKey = "viewed_listings";
    const viewed: string[] = JSON.parse(localStorage.getItem(viewedKey) ?? "[]");
    const listingId = id ?? "";
    const alreadyViewed = viewed.includes(listingId);

    api.get<IListingDetail>(`/listings/${id}${alreadyViewed ? "?no_track=true" : ""}`)
      .then((r) => {
        setListing(r.data);
        const sellerFirst = (r.data.seller.full_name ?? "there").split(" ")[0];
        setMsgBody(`Hi ${sellerFirst},\nI'm interested in your "${r.data.title}". Is it still available?`);
        if (!alreadyViewed) {
          const updated = [...viewed, listingId].slice(-200);
          localStorage.setItem(viewedKey, JSON.stringify(updated));
        }
      })
      .catch(() => navigate("/listings"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const isOwner = user?.id === listing?.seller_id;

  const handleDelete = async () => {
    await api.delete(`/listings/${id}`);
    toast.success(t.listingDeleted);
    navigate(`/profile/${user?.id}`);
  };

  const handleMarkSold = async () => {
    setSoldToLoading(true);
    try {
      const { data: convs } = await api.get<ConversationSummary[]>(`/messages/by-listing/${id}`);
      if (convs.length === 0) {
        await api.patch(`/listings/${id}`, { status: "sold" });
        setListing((l) => l ? { ...l, status: "sold" } : l);
        toast.success(t.markedAsSold);
      } else if (convs.length === 1) {
        await api.patch(`/listings/${id}`, { status: "sold", sold_to_conversation_id: convs[0].conversation_id });
        setListing((l) => l ? { ...l, status: "sold" } : l);
        toast.success(t.markedAsSold);
        api.get<PendingRating[]>("/ratings/pending").then((r) => setPendingRatings(r.data)).catch(() => {});
      } else {
        setSoldToConversations(convs);
        setShowSoldToModal(true);
      }
    } catch {
      toast.error(t.failedToSendMessage);
    } finally {
      setSoldToLoading(false);
    }
  };

  const handleSoldToConfirm = async (conversationId: string) => {
    setShowSoldToModal(false);
    try {
      await api.patch(`/listings/${id}`, { status: "sold", sold_to_conversation_id: conversationId });
      setListing((l) => l ? { ...l, status: "sold" } : l);
      toast.success(t.markedAsSold);
      api.get<PendingRating[]>("/ratings/pending").then((r) => setPendingRatings(r.data)).catch(() => {});
    } catch {
      toast.error(t.failedToSendMessage);
    }
  };

  const handleSoldToSkip = async () => {
    setShowSoldToModal(false);
    try {
      await api.patch(`/listings/${id}`, { status: "sold" });
      setListing((l) => l ? { ...l, status: "sold" } : l);
      toast.success(t.markedAsSold);
    } catch {
      toast.error(t.failedToSendMessage);
    }
  };

  const handleMarkReserved = async () => {
    await api.patch(`/listings/${id}`, { status: "reserved" });
    setListing((l) => l ? { ...l, status: "reserved" } : l);
    toast.success(t.markedAsReserved);
  };

  const handleMarkActive = async () => {
    await api.patch(`/listings/${id}`, { status: "active" });
    setListing((l) => l ? { ...l, status: "active" } : l);
    toast.success(t.markedAsActive);
  };

  const handleRenew = async () => {
    await api.post(`/listings/${id}/renew`);
    setListing((l) => l ? { ...l, status: "active" } : l);
    toast.success(t.listingRenewed);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (!msgBody.trim()) return;
    setSendingMsg(true);
    try {
      await api.post(`/messages/start/${id}`, { body: msgBody });
      toast.success(t.messageSent);
      setMsgBody("");
      navigate("/messages");
    } catch {
      toast.error(t.failedToSendMessage);
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-[4/3] bg-gray-200 rounded-xl" />
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
    </div>
  );

  if (!listing) return null;

  const imgs = listing.images;
  const imgAlt = [listing.title, catName(listing.category, lang), listing.location, "Aruba"].filter(Boolean).join(" — ");
  const seoTitle = `${listing.title} — AWG ${listing.price}`;
  const seoDesc = listing.description.slice(0, 160);
  const seoImage = listing.images[0] || undefined;
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    image: listing.images,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "AWG",
      availability: listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      itemCondition: listing.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    },
  };

  return (
    <>
    <SEO title={seoTitle} description={seoDesc} image={seoImage} jsonLd={productLd} />
    {pendingRatings.length > 0 && (
      <RatingModal
        pending={pendingRatings[0]}
        onDismiss={() => setPendingRatings((prev) => prev.slice(1))}
        onSubmitted={() => setPendingRatings((prev) => prev.slice(1))}
      />
    )}
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          t={t}
        />
      )}
      {showReportModal && id && (
        <ReportModal listingId={id} onClose={() => setShowReportModal(false)} t={t} />
      )}
      {showSoldToModal && (
        <SoldToModal
          conversations={soldToConversations}
          onConfirm={handleSoldToConfirm}
          onSkip={handleSoldToSkip}
          onCancel={() => setShowSoldToModal(false)}
          t={t}
        />
      )}

      {/* Lightbox */}
      {lightboxOpen && imgs.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 overflow-hidden flex flex-col"
          onClick={() => setLightboxOpen(false)}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchMove={(e) => {
            if (touchStartX.current === null || imgs.length <= 1) return;
            setDragOffset(e.touches[0].clientX - touchStartX.current);
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || imgs.length <= 1) { setDragOffset(0); return; }
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            setDragOffset(0);
            if (Math.abs(dx) < 50) return;
            if (dx < 0) setImgIndex(i => (i + 1) % imgs.length);
            else setImgIndex(i => (i - 1 + imgs.length) % imgs.length);
          }}
        >
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 z-10 text-white/70 hover:text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          {imgs.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setImgIndex(i => (i - 1 + imgs.length) % imgs.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white p-2 bg-black/30 rounded-full">
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setImgIndex(i => (i + 1) % imgs.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white p-2 bg-black/30 rounded-full">
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}
          <div className="flex-1 flex items-center justify-center px-2 sm:px-12 min-h-0">
            <img
              src={imgs[imgIndex]}
              alt={imgAlt}
              className="max-w-full max-h-full object-contain select-none"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>
          {imgs.length > 1 && (
            <div className="shrink-0 flex justify-center gap-2 py-3 px-4 overflow-x-auto scrollbar-none">
              {imgs.map((src, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                  className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        {listing.category.parent ? (
          <>
            <Link to={`/listings?category=${listing.category.parent.slug}`} className="hover:text-ocean-600">{catName(listing.category.parent, lang)}</Link>
            <span>/</span>
            <Link to={`/listings?category=${listing.category.slug}`} className="hover:text-ocean-600">{catName(listing.category, lang)}</Link>
          </>
        ) : (
          <Link to={`/listings?category=${listing.category.slug}`} className="hover:text-ocean-600">{catName(listing.category, lang)}</Link>
        )}
        <span>/</span>
        <span className="text-gray-900 truncate">{listing.title}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Images */}
        <div className="md:col-span-3">
          <div
            className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null || imgs.length <= 1) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) < 50) return;
              if (dx < 0) setImgIndex(i => (i + 1) % imgs.length);
              else setImgIndex(i => (i - 1 + imgs.length) % imgs.length);
            }}
          >
            {imgs.length > 0 ? (
              <>
                <img
                  src={imgs[imgIndex]}
                  alt={imgAlt}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxOpen(true)}
                  draggable={false}
                />
                {imgs.length > 1 && (
                  <>
                    <button onClick={() => setImgIndex((i) => (i - 1 + imgs.length) % imgs.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-1.5 rounded-full hover:bg-black/60">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setImgIndex((i) => (i + 1) % imgs.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-1.5 rounded-full hover:bg-black/60">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {imgs.map((_, i) => (
                        <button key={i} onClick={() => setImgIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === imgIndex ? "bg-white" : "bg-white/50"}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="aspect-[4/3] flex items-center justify-center text-gray-300">
                <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {imgs.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {imgs.map((img, i) => (
                <button key={i} onClick={() => setImgIndex(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? "border-ocean-500" : "border-transparent"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Attributes */}
          {Object.keys(listing.attributes).length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-gray-900 mb-3">{t.details}</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(listing.attributes).map(([k, v]) => {
                  const schema = listing.category.attributes.find(a => a.key === k);
                  const label = (lang === "es" && schema?.label_es) ? schema.label_es : (schema?.label ?? k.replace(/_/g, " "));
                  let displayValue = String(v);
                  if (lang === "es" && schema?.options && schema?.options_es) {
                    const idx = schema.options.indexOf(displayValue);
                    if (idx !== -1 && schema.options_es[idx]) displayValue = schema.options_es[idx];
                  }
                  return (
                    <div key={k} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 capitalize">{label}</div>
                      <div className="text-sm font-medium text-gray-900">{displayValue}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mt-6">
            <h2 className="font-semibold text-gray-900 mb-2">{t.description}</h2>
            <p className="text-gray-600 whitespace-pre-wrap text-sm leading-relaxed">{listing.description}</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="md:col-span-2 space-y-4">
          <div className="card p-5">
            {/* Status badge */}
            {listing.status !== "active" && (
              <div className="mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  listing.status === "sold"
                    ? "bg-green-100 text-green-700"
                    : listing.status === "reserved"
                    ? "bg-amber-100 text-amber-700"
                    : listing.status === "expired"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {statusLabels[listing.status]}
                </span>
              </div>
            )}

            <h1 className="text-xl font-bold text-gray-900 mb-2">{listing.title}</h1>
            <div className={`text-3xl font-bold mb-1 ${parseFloat(listing.price) === 0 ? "text-green-600" : "text-ocean-600"}`}>
              {parseFloat(listing.price) === 0
                ? t.free
                : formatPrice(parseFloat(listing.price))}
            </div>
            {listing.is_negotiable && parseFloat(listing.price) > 0 && <div className="text-sm text-gray-500 mb-3">{t.priceNegotiable}</div>}

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm px-2.5 py-1 bg-ocean-50 text-ocean-700 rounded-full font-medium">{catName(listing.category, lang)}</span>
              <span className="text-sm px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">{conditionLabels[listing.condition]}</span>
            </div>

            <div className="space-y-1.5 text-sm text-gray-500 mb-4">
              {(listing.seller.location || listing.location) && (
                <LocationMap
                  location={listing.seller.location ?? listing.location!}
                  className="text-sm text-gray-500"
                />
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" />
                {t.listedAgo.replace("{time}", formatDistanceToNow(new Date(listing.created_at), { locale: lang === "es" ? es : undefined }))}
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 shrink-0" />
                {listing.view_count !== 1
                  ? t.viewCountPlural.replace("{n}", String(listing.view_count))
                  : t.viewCount.replace("{n}", String(listing.view_count))}
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 shrink-0 text-red-400" />
                {listing.favorite_count !== 1
                  ? t.favoriteCountPlural.replace("{n}", String(listing.favorite_count))
                  : t.favoriteCount.replace("{n}", String(listing.favorite_count))}
              </div>
            </div>

            {/* Actions */}
            {isOwner ? (
              <div className="space-y-2">
                {listing.status === "active" && (
                  <>
                    <button onClick={handleMarkSold} disabled={soldToLoading} className="btn-secondary w-full gap-2 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" /> {t.markAsSold}
                    </button>
                    <button onClick={handleMarkReserved} className="btn-secondary w-full gap-2">
                      <Clock className="w-4 h-4" /> {t.markAsReserved}
                    </button>
                  </>
                )}
                {listing.status === "reserved" && (
                  <>
                    <button onClick={handleMarkSold} disabled={soldToLoading} className="btn-secondary w-full gap-2 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" /> {t.markAsSold}
                    </button>
                    <button onClick={handleMarkActive} className="btn-secondary w-full gap-2 text-amber-700 border-amber-200 hover:bg-amber-50">
                      <Clock className="w-4 h-4" /> {t.removeReservation}
                    </button>
                  </>
                )}
                {listing.status === "sold" && (
                  <button onClick={handleMarkActive} className="btn-secondary w-full gap-2 text-ocean-700 border-ocean-200 hover:bg-ocean-50">
                    <CheckCircle className="w-4 h-4" /> {t.relistActive}
                  </button>
                )}
                {listing.status === "expired" && (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {t.expiredNote}
                    </p>
                    <button onClick={handleRenew} className="btn-secondary w-full gap-2 text-ocean-700 border-ocean-200 hover:bg-ocean-50">
                      <RefreshCw className="w-4 h-4" /> {t.renewListing}
                    </button>
                  </div>
                )}
                <Link to={`/listings/${id}/edit`} className="btn-secondary w-full justify-center gap-2">
                  <Edit className="w-4 h-4" /> {t.editListing}
                </Link>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" /> {t.delete}
                </button>
              </div>
            ) : (listing.status === "active" || listing.status === "reserved") ? (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {listing.status === "reserved" && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    {t.reservedNote}
                  </p>
                )}
                <div className="relative group">
                  <textarea
                    placeholder="Hi, is this still available?"
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    rows={4}
                    disabled={!user}
                    className="input resize-none text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!user && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Link to="/login" className="bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg underline pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        {t.loginToContact}
                      </Link>
                    </div>
                  )}
                </div>
                {!user ? (
                  <Link to="/login" className="btn-primary w-full justify-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    {t.logInToSend}
                  </Link>
                ) : (
                  <button type="submit" disabled={sendingMsg} className="btn-primary w-full gap-2">
                    <MessageCircle className="w-4 h-4" />
                    {sendingMsg ? t.sending2 : t.sendMessage2}
                  </button>
                )}
              </form>
            ) : (
              <div className="text-center py-4 text-gray-400 text-sm">{t.noLongerAvailable}</div>
            )}
          </div>

          {/* Seller card */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{t.seller}</h3>
            <Link to={`/profile/${listing.seller.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {listing.seller.avatar_url ? (
                <img src={listing.seller.avatar_url} alt={listing.seller.full_name ?? "Seller"} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center font-semibold text-sm">
                  {(listing.seller.full_name ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-medium text-gray-900 text-sm">{listing.seller.full_name ?? "Unknown"}</div>
                {listing.seller.languages && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {listing.seller.languages.split(",").map(l => l.trim()).filter(Boolean).map(l => {
                      const meta = LANG_META[l];
                      return meta ? (
                        <span key={l} className="flex items-center gap-0.5 text-xs text-gray-500">
                          <span className="text-sm leading-none">{meta.flag}</span>
                          {lang === "es" ? meta.label_es : meta.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </Link>
            {(listing.seller.location || listing.seller.avg_rating != null) && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {listing.seller.location && (
                  <LocationMap location={listing.seller.location} className="text-xs text-gray-500" />
                )}
                {listing.seller.avg_rating != null && (
                  <StarDisplay rating={listing.seller.avg_rating} count={listing.seller.rating_count} size="xs" />
                )}
              </div>
            )}
            {listing.seller.contact_method && !isOwner && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide">{t.contactVia}</p>
                <div className="flex flex-wrap gap-2">
                  {listing.seller.contact_method.split(",").map(m => m.trim()).filter(Boolean).map((method) => {
                    if (method === "whatsapp" && listing.seller.whatsapp) {
                      const wa = listing.seller.whatsapp.replace(/\D/g, "");
                      return (
                        <a key={method} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.571a.75.75 0 00.943.878l5.919-1.953A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.614-.498-5.13-1.373l-.368-.217-3.814 1.259 1.198-3.698-.237-.381A9.943 9.943 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                          </svg>
                          WhatsApp
                        </a>
                      );
                    }
                    if (method === "phone" && listing.seller.phone) {
                      return (
                        <a key={method} href={`tel:${listing.seller.phone}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                          {listing.seller.phone}
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Report button — non-owners only */}
          {!isOwner && (
            <div className="text-center">
              <button
                onClick={() => setShowReportModal(true)}
                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 mx-auto transition-colors"
              >
                <Flag className="w-3 h-3" /> {t.reportListing}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
