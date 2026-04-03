import React from "react";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useFavorites } from "../contexts/FavoritesContext";

interface Props {
  listingId: string;
  sellerId?: string;
  className?: string;
}

export default function FavoriteButton({ listingId, sellerId, className = "" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { favoriteIds, toggle } = useFavorites();
  const isFav = favoriteIds.has(listingId);

  // Don't show the button for own listings
  if (user && sellerId !== undefined && user.id === sellerId) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/login"); return; }
    await toggle(listingId);
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-full transition-colors ${isFav ? "text-red-500 bg-red-50 hover:bg-red-100" : "text-gray-400 bg-white/80 hover:text-red-400"} ${className}`}
      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
    </button>
  );
}
