import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import Footer from "../components/Footer";

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );
}

describe("Footer", () => {
  it("renders the brand name", () => {
    renderFooter();
    expect(screen.getAllByText(/marketplace/i).length).toBeGreaterThan(0);
  });

  it("renders .aw", () => {
    renderFooter();
    expect(screen.getAllByText(/\.aw/i).length).toBeGreaterThan(0);
  });

  it("renders tagline", () => {
    renderFooter();
    expect(screen.getByText(/aruba/i)).toBeInTheDocument();
  });

  it("renders Contact Us link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: /contact us/i })).toBeInTheDocument();
  });

  it("renders copyright with current year", () => {
    renderFooter();
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
