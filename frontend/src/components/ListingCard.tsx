import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Eye, MoreHorizontal } from "lucide-react";
import * as Icons from "lucide-react";
import { Listing } from "../api";
import FavoriteButton from "./FavoriteButton";
import { useLang } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";

const CONDITION_COLORS: Record<string, string> = {
  new:      "bg-green-100 text-green-700 border-green-200",
  like_new: "bg-emerald-100 text-emerald-700 border-emerald-200",
  good:     "bg-blue-100 text-blue-700 border-blue-200",
  fair:     "bg-yellow-100 text-yellow-700 border-yellow-200",
  poor:     "bg-red-100 text-red-700 border-red-200",
};

function CatIcon({ name, className = "w-3.5 h-3.5" }: { name?: string | null; className?: string }) {
  const Icon = (name && (Icons as unknown as Record<string, Icons.LucideIcon>)[name]) || MoreHorizontal;
  return <Icon className={className} />;
}

interface Props {
  listing: Listing;
}

export default function ListingCard({ listing }: Props) {
  const { t } = useLang();
  const { currency, formatPrice } = useCurrency();
  const conditionLabels: Record<string, string> = {
    new: t.condNew, like_new: t.condLikeNew, good: t.condGood, fair: t.condFair, poor: t.condPoor,
  };
  const thumb = listing.thumbnail ?? listing.images[0];
  const location = listing.seller_location ?? listing.location;

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
        {thumb ? (
          <img
            src={thumb}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
            <svg className="w-14 h-14 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Price badge */}
        <div className="absolute bottom-2 left-2">
          <span className={`text-white text-sm font-bold px-2.5 py-1 rounded-lg shadow-md ${parseFloat(listing.price) === 0 ? "bg-green-600" : "bg-ocean-600"}`}>
            {parseFloat(listing.price) === 0
              ? t.free
              : <>{formatPrice(parseFloat(listing.price))}{listing.is_negotiable && currency === "AWG" && <span className="font-normal opacity-80 ml-1">OBO</span>}</>
            }
          </span>
        </div>

        {/* Condition / Reserved / Expired badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {listing.status === "reserved" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
              {t.reserved}
            </span>
          )}
          {listing.status === "expired" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
              {t.statusExpired}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${CONDITION_COLORS[listing.condition] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {conditionLabels[listing.condition] ?? listing.condition}
          </span>
        </div>

        {/* Favorite */}
        <div className="absolute top-1.5 right-1.5">
          <FavoriteButton listingId={listing.id} sellerId={listing.seller_id} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-ocean-600 transition-colors leading-snug mb-auto pb-2">
          {listing.title}
        </h3>
        <div className="flex items-center justify-between text-xs text-gray-400 mt-auto gap-2">
          {/* Category icon + location */}
          <div className="flex items-center gap-1.5 truncate min-w-0">
            <CatIcon name={listing.category_icon} className="w-3.5 h-3.5 shrink-0 text-gray-400" />
            {location && (
              <>
                <span className="text-gray-300">·</span>
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{location}</span>
              </>
            )}
          </div>
          {/* View count */}
          <div className="flex items-center gap-1 shrink-0">
            <Eye className="w-3 h-3" />{listing.view_count}
          </div>
        </div>
      </div>
    </Link>
  );
}
