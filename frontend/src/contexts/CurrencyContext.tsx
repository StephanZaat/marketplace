import React, { createContext, useContext, useState } from "react";

export type Currency = "AWG" | "USD";

const AWG_TO_USD = 1 / 1.77; // 1 AWG = ~0.565 USD

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (awgAmount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const stored = (localStorage.getItem("currency") ?? "AWG") as Currency;
  const [currency, setCurrencyState] = useState<Currency>(stored === "USD" ? "USD" : "AWG");

  const setCurrency = (c: Currency) => {
    localStorage.setItem("currency", c);
    setCurrencyState(c);
  };

  const formatPrice = (awgAmount: number): string => {
    if (currency === "USD") {
      const usd = awgAmount * AWG_TO_USD;
      return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `ƒ${awgAmount.toLocaleString("en-AW", { minimumFractionDigits: 0 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
