import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LocationMap from "../components/LocationMap";

function clickMapButton(location: string) {
  fireEvent.click(screen.getByRole("button", { name: location }));
}

describe("LocationMap", () => {
  it("renders a button with the location name", () => {
    render(<LocationMap location="Oranjestad" />);
    expect(screen.getByRole("button", { name: "Oranjestad" })).toBeInTheDocument();
  });

  it("opens the modal when clicked", () => {
    render(<LocationMap location="Palm Beach" />);
    clickMapButton("Palm Beach");
    expect(screen.getByText("Palm Beach, Aruba")).toBeInTheDocument();
    expect(screen.getByTitle("Map of Palm Beach")).toBeInTheDocument();
  });

  it("closes the modal when X is clicked", () => {
    render(<LocationMap location="Noord" />);
    clickMapButton("Noord");
    expect(screen.getByText("Noord, Aruba")).toBeInTheDocument();
    const allButtons = screen.getAllByRole("button");
    const closeBtn = allButtons.find((b) => b.textContent === "");
    fireEvent.click(closeBtn!);
    expect(screen.queryByText("Noord, Aruba")).not.toBeInTheDocument();
  });

  it("renders the OSM iframe with correct marker coords for known area", () => {
    render(<LocationMap location="Oranjestad" />);
    clickMapButton("Oranjestad");
    const iframe = screen.getByTitle("Map of Oranjestad") as HTMLIFrameElement;
    expect(iframe.src).toContain("marker=12.5186");
    expect(iframe.src).toContain("-70.0358");
  });

  it("renders OSM link pointing to the correct area", () => {
    render(<LocationMap location="San Nicolas" />);
    clickMapButton("San Nicolas");
    const link = screen.getByRole("link", { name: /open in openstreetmap/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("San%20Nicolas"));
  });
});
