import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import api, { Listing } from "../api";
import { useCurrency } from "../contexts/CurrencyContext";

interface Props {
  /** Extra classes for the outer wrapper */
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  /**
   * When set, renders a sibling submit button with this label inside the wrapper.
   * The wrapper must be a flex container for it to sit inline.
   */
  buttonLabel?: string;
  buttonClassName?: string;
  /** Called when the user submits (Enter / button). If omitted, navigates to /listings?q= */
  onSubmit?: (query: string) => void;
  /** When true, keeps the input in sync with the URL ?q= param */
  syncUrl?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchInput({ className = "", inputClassName = "", placeholder = "Search listings...", buttonLabel, buttonClassName = "", onSubmit, syncUrl }: Props) {
  const [params] = useSearchParams();
  const urlQ = syncUrl ? (params.get("q") ?? "") : "";
  const [query, setQuery] = useState(urlQ);
  const [suggestions, setSuggestions] = useState<Listing[]>([]);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { formatPrice: fmtPrice } = useCurrency();

  // Keep in sync with URL param when syncUrl is enabled
  useEffect(() => {
    if (syncUrl) setQuery(urlQ);
  }, [urlQ, syncUrl]);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    api
      .get<Listing[]>(`/listings?q=${encodeURIComponent(debouncedQuery.trim())}&limit=6`)
      .then((r) => {
        setSuggestions(r.data);
        setOpen(r.data.length > 0);
      })
      .catch(() => {
        setSuggestions([]);
        setOpen(false);
      });
  }, [debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    if (onSubmit) {
      onSubmit(trimmed);
    } else {
      navigate(`/listings?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(query);
  };

  const handleSelect = (listing: Listing) => {
    setQuery(listing.title);
    setOpen(false);
    navigate(`/listings/${listing.id}`);
  };

  const formatPrice = (l: Listing) => {
    if (l.price === "0" || l.price === "0.00") return "Free";
    return fmtPrice(parseFloat(l.price));
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className={buttonLabel ? "flex" : undefined}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            className={inputClassName}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {buttonLabel && (
          <button type="submit" className={buttonClassName}>
            {buttonLabel}
          </button>
        )}
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={() => handleSelect(l)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ocean-50 text-left transition-colors"
              >
                {(l.thumbnail ?? l.images?.[0]) ? (
                  <img src={(l.thumbnail ?? l.images[0])!} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">{l.title}</div>
                  <div className="text-xs text-gray-400">{formatPrice(l)}</div>
                </div>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(query)}
              className="w-full px-4 py-2 text-xs text-ocean-600 hover:bg-ocean-50 text-left font-medium border-t border-gray-100 transition-colors"
            >
              See all results for "{query}"
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
