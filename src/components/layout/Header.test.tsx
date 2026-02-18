import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock next/image to render a plain img
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

describe("Header", () => {
  const user = userEvent.setup();

  it("renders the brand logo", () => {
    render(<Header />);
    expect(screen.getByAltText("meantforgreatness")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Header />);
    const homeLinks = screen.getAllByText("Home");
    expect(homeLinks.length).toBeGreaterThan(0);
    const orphanageLinks = screen.getAllByText("Orphanages");
    expect(orphanageLinks.length).toBeGreaterThan(0);
  });

  it("renders Donate Now button", () => {
    render(<Header />);
    const donateButtons = screen.getAllByText("Donate Now");
    expect(donateButtons.length).toBeGreaterThan(0);
  });

  it("Donate Now links to /donate", () => {
    render(<Header />);
    const donateLinks = screen.getAllByText("Donate Now");
    for (const link of donateLinks) {
      expect(link.closest("a")).toHaveAttribute("href", "/donate");
    }
  });

  it("brand logo links to home", () => {
    render(<Header />);
    const brand = screen.getByAltText("meantforgreatness");
    expect(brand.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders mobile menu toggle button", () => {
    render(<Header />);
    expect(screen.getByLabelText("Toggle navigation menu")).toBeInTheDocument();
  });

  it("toggles mobile menu on click", async () => {
    render(<Header />);
    const toggleBtn = screen.getByLabelText("Toggle navigation menu");

    // Mobile nav links are in the DOM but inside the hidden sm:hidden div
    // Before clicking, mobile menu content should not be visible
    // After clicking, mobile menu should appear
    await user.click(toggleBtn);

    // Mobile menu should now be visible — check for links within it
    // The mobile menu renders extra copies of the links
    const homeLinks = screen.getAllByText("Home");
    expect(homeLinks.length).toBeGreaterThanOrEqual(2); // desktop + mobile

    // Click again to close
    await user.click(toggleBtn);
    // After closing, we should be back to just desktop links
    const homeLinksAfter = screen.getAllByText("Home");
    expect(homeLinksAfter.length).toBe(1); // only desktop
  });
});
