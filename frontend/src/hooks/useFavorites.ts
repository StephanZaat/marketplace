import { useState, useEffect } from "react";
import api, { Listing } from "../api";
import { useAuth } from "../contexts/AuthContext";

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setFavoriteIds(new Set()); return; }
    api.get<Listing[]>("/favorites")
      .then((r) => setFavoriteIds(new Set(r.data.map((l) => l.id))))
      .catch(() => {});
  }, [user]);

  const toggle = async (listingId: string) => {
    if (!user) return false; // caller can redirect to login
    const isFav = favoriteIds.has(listingId);
    // Optimistic update
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
    } catch {
      // Revert on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        isFav ? next.add(listingId) : next.delete(listingId);
        return next;
      });
    }
    return !isFav;
  };

  return { favoriteIds, toggle };
}
