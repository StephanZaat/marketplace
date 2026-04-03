import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import ListingCard from "../components/ListingCard";
import { Listing } from "../api";

// Mock contexts used by FavoriteButton
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../contexts/FavoritesContext", () => ({
  useFavorites: () => ({ favoriteIds: new Set(), toggle: vi.fn() }),
}));

const baseListing: Listing = {
  id: "abc123test",
  title: "Test Surfboard",
  description: "Great condition surfboard",
  price: "250.00",
  is_negotiable: false,
  condition: "good",
  status: "active",
  seller_id: "seller0001",
  category_id: "cat0000002",
  location: "Palm Beach",
  seller_location: null,
  contact_method: null,
  images: [],
  attributes: {},
  view_count: 42,
  category_icon: null,
  category_name: "Watersports",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

function renderCard(listing = baseListing) {
  return render(
    <MemoryRouter>
      <ListingCard listing={listing} />
    </MemoryRouter>
  );
}

describe("ListingCard", () => {
  it("renders the listing title", () => {
    renderCard();
    expect(screen.getByText("Test Surfboard")).toBeInTheDocument();
  });

  it("renders the price", () => {
    renderCard();
    expect(screen.getByText(/250/)).toBeInTheDocument();
  });

  it("renders Free for zero price", () => {
    renderCard({ ...baseListing, price: "0.00" });
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders OBO when negotiable", () => {
    renderCard({ ...baseListing, is_negotiable: true });
    expect(screen.getByText(/obo/i)).toBeInTheDocument();
  });

  it("renders condition badge", () => {
    renderCard();
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("renders Reserved badge when status is reserved", () => {
    renderCard({ ...baseListing, status: "reserved" });
    expect(screen.getByText("Reserved")).toBeInTheDocument();
  });

  it("renders location from seller_location when available", () => {
    renderCard({ ...baseListing, seller_location: "Noord" });
    expect(screen.getByText("Noord")).toBeInTheDocument();
  });

  it("renders location from listing.location as fallback", () => {
    renderCard();
    expect(screen.getByText("Palm Beach")).toBeInTheDocument();
  });

  it("renders view count", () => {
    renderCard();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("links to the listing detail page", () => {
    renderCard();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/listings/abc123test");
  });
});
