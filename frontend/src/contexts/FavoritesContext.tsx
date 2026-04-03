import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import api, { Listing } from "../api";
import { useAuth } from "./AuthContext";

interface FavoritesContextType {
  favoriteIds: Set<string>;
  toggle: (listingId: string) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteIds: new Set(),
  toggle: async () => false,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setFavoriteIds(new Set()); return; }
    api.get<Listing[]>("/favorites")
      .then((r) => setFavoriteIds(new Set(r.data.map((l) => l.id))))
      .catch(() => {});
  }, [user]);

  const toggle = useCallback(async (listingId: string): Promise<boolean> => {
    const isFav = favoriteIds.has(listingId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(listingId) : next.add(listingId);
      return next;
    });
    try {
      if (isFav) {
        await api.delete(`/favorites/${listingId}`);
      } else {
        await api.post(`/favorites/${listingId}`);
      }
      return !isFav;
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        isFav ? next.add(listingId) : next.delete(listingId);
        return next;
      });
      return isFav;
    }
  }, [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
