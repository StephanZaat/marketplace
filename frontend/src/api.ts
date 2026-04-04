import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url: string = err.config?.url ?? "";
    const hasToken = !!localStorage.getItem("token");
    // Only force-logout on 401 when the user has a stored token and
    // it's not a background poll (unread count) — those silently fail
    if (status === 401 && hasToken && !url.includes("/messages/unread") && !url.includes("/auth/me")) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  full_name: string | null;
  location: string | null;
  avatar_url: string | null;
  whatsapp: string | null;
  contact_method: string | null;
  languages: string | null;
  preferred_language: string | null;
  // Conditionally present on listing detail when seller opted into these contact methods
  email?: string | null;
  phone?: string | null;
  created_at: string;
  avg_rating?: number | null;
  rating_count?: number;
}

export interface UserMe extends User {
  email: string;
  phone: string | null;
  is_verified: boolean;
}

export interface CategoryAttrField {
  key: string;
  label: string;
  label_es?: string;
  type: "text" | "select";
  options?: string[];
  options_es?: string[];
}

export interface CategoryParent {
  id: string;
  name: string;
  name_es?: string | null;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  name_es?: string | null;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
  parent?: CategoryParent | null;
  attributes: CategoryAttrField[];
}

export interface CategoryTree extends Category {
  children: CategoryTree[];
  listing_count: number;
}

/** Returns the localized category name based on current language. */
export function catName(cat: { name: string; name_es?: string | null }, lang: string): string {
  return (lang === "es" && cat.name_es) ? cat.name_es : cat.name;
}

export type ListingCondition = "new" | "like_new" | "good" | "fair" | "poor";
export type ListingStatus = "active" | "sold" | "reserved" | "inactive" | "expired";

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: string;
  is_negotiable: boolean;
  condition: ListingCondition;
  status: ListingStatus;
  seller_id: string;
  category_id: string;
  location: string | null;
  contact_method: string | null;
  images: string[];
  thumbnail: string | null;
  attributes: Record<string, unknown>;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Denormalised fields from the list endpoint
  seller_location?: string | null;
  seller_languages?: string | null;
  seller_avg_rating?: number | null;
  category_icon?: string | null;
  category_name?: string | null;
  category_name_es?: string | null;
}

export interface ListingDetail extends Listing {
  seller: User;
  category: Category;
  favorite_count: number;
}

export interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  updated_at: string;
  listing: Listing;
  buyer: User;
  seller: User;
  messages: Message[];
  unread_count: number;
}

export interface ConversationSummary {
  conversation_id: string;
  buyer_id: string;
  buyer_name: string | null;
}

export interface PendingRating {
  conversation_id: string;
  listing_id: string;
  listing_title: string;
  other_user_id: string;
  other_user_name: string | null;
  role: "buyer_rating_seller" | "seller_rating_buyer";
}

export interface UserRatingStats {
  as_seller: {
    avg_description: number | null;
    avg_communication: number | null;
    avg_exchange: number | null;
    avg_overall: number | null;
    count: number;
  };
  as_buyer: {
    avg_overall: number | null;
    count: number;
  };
}
