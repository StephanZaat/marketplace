import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { PHONE_COUNTRIES, DEFAULT_COUNTRY, splitPhone, type PhoneCountry } from "../lib/phoneCountries";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

export default function PhoneInput({ value, onChange, placeholder = "560 0000", id, disabled }: Props) {
  const { country: initialCountry, number: initialNumber } = splitPhone(value);
  const [country, setCountry] = useState<PhoneCountry>(initialCountry);
  const [number, setNumber] = useState(initialNumber);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. form reset), but don't reset the
  // country when the number is cleared — keep the user's selected dial code.
  useEffect(() => {
    const { country: c, number: n } = splitPhone(value);
    if (value) setCountry(c);
    setNumber(n);
  }, [value]);

  const emit = (c: PhoneCountry, n: string) => {
    onChange(n ? `${c.code} ${n}` : "");
  };

  const handleCountry = (c: PhoneCountry) => {
    setCountry(c);
    setOpen(false);
    setSearch("");
    emit(c, number);
  };

  const q = search.toLowerCase();
  const filtered = PHONE_COUNTRIES.filter(c =>
    (c.iso === "––" && !q) ||
    c.name.toLowerCase().includes(q) ||
    c.code.includes(q)
  );

  const handleNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setNumber(digits);
    emit(country, digits);
  };

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
    else setSearch("");
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Default to +297 when component first mounts with no value
  useEffect(() => {
    if (!value) {
      setCountry(DEFAULT_COUNTRY);
      setNumber("");
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} className={`flex gap-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Country code dropdown */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="input flex items-center gap-1.5 px-3 min-w-[5.5rem] text-sm"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="font-medium text-gray-700">{country.code}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1 flex flex-col max-h-72">
            <div className="px-3 py-2 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country…"
                  className="w-full text-sm text-gray-700 outline-none placeholder-gray-400"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
            {filtered.map((c, i) =>
              c.iso === "––" ? (
                <hr key={`sep-${i}`} className="my-1 border-gray-200" />
              ) : (
                <button
                  key={`${c.iso}-${c.code}`}
                  type="button"
                  onClick={() => handleCountry(c)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-ocean-50 hover:text-ocean-700 ${
                    c.iso === country.iso ? "bg-ocean-50 text-ocean-700 font-medium" : "text-gray-700"
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-gray-400 shrink-0">{c.code}</span>
                </button>
              )
            )}
            </div>
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        id={id}
        type="tel"
        value={number}
        onChange={handleNumber}
        placeholder={placeholder}
        className="input flex-1 text-sm"
      />
    </div>
  );
}
