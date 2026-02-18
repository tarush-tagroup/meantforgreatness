import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DonationForm from "./DonationForm";

// Mock window.location
Object.defineProperty(window, "location", {
  value: { href: "" },
  writable: true,
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function getPresetButton(amount: number) {
  // Presets render with toLocaleString() (e.g. 1500 → "$1,500")
  const formatted = `$${amount.toLocaleString()}`;
  const buttons = screen.getAllByRole("button");
  const match = buttons.find(
    (btn) => btn.textContent?.trim() === formatted && btn.getAttribute("type") === "button"
  );
  if (!match) throw new Error(`Preset button ${formatted} not found`);
  return match;
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /donate|redirecting/i });
}

describe("DonationForm", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/payment-config") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ stripeEnabled: true, paypalEnabled: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: "https://checkout.stripe.com/session_123" }),
      });
    });
    window.location.href = "";
  });

  describe("rendering", () => {
    it("renders the form with frequency toggle", () => {
      render(<DonationForm />);
      expect(screen.getByText("One-time")).toBeInTheDocument();
      expect(screen.getByText("Monthly")).toBeInTheDocument();
      expect(screen.getByText("Yearly")).toBeInTheDocument();
    });

    it("renders monthly preset amount buttons by default", () => {
      render(<DonationForm />);
      expect(getPresetButton(75)).toBeInTheDocument();
      expect(getPresetButton(225)).toBeInTheDocument();
      expect(getPresetButton(675)).toBeInTheDocument();
    });

    it("renders one-time preset amount buttons when switched", async () => {
      render(<DonationForm />);
      await user.click(screen.getByText("One-time"));
      expect(getPresetButton(150)).toBeInTheDocument();
      expect(getPresetButton(500)).toBeInTheDocument();
      expect(getPresetButton(1500)).toBeInTheDocument();
    });

    it("renders other amount input", () => {
      render(<DonationForm />);
      expect(screen.getByPlaceholderText("Other amount (min $10)")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<DonationForm />);
      expect(getSubmitButton()).toBeInTheDocument();
    });

    it("defaults to monthly and $75", () => {
      render(<DonationForm />);
      expect(getSubmitButton().textContent).toMatch(/Donate \$75\/month/);
    });
  });

  describe("amount selection", () => {
    it("selects a preset amount", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(225));
      expect(getSubmitButton().textContent).toMatch(/Donate \$225/);
    });

    it("switches to custom amount when typing", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Other amount (min $10)");
      await user.type(input, "80");
      expect(getSubmitButton().textContent).toMatch(/Donate \$80/);
    });

    it("switches back to preset after selecting custom", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Other amount (min $10)");
      await user.type(input, "80");
      await user.click(getPresetButton(225));
      expect(getSubmitButton().textContent).toMatch(/Donate \$225/);
    });
  });

  describe("frequency toggle", () => {
    it("switches to one-time", async () => {
      render(<DonationForm />);
      await user.click(screen.getByText("One-time"));
      const text = getSubmitButton().textContent!;
      expect(text).toMatch(/Donate \$150/);
      expect(text).not.toMatch(/\/month/);
    });

    it("switches back to monthly", async () => {
      render(<DonationForm />);
      await user.click(screen.getByText("One-time"));
      await user.click(screen.getByText("Monthly"));
      expect(getSubmitButton().textContent).toMatch(/Donate \$75\/month/);
    });
  });

  describe("sponsorship context messages", () => {
    it("shows 'Sponsor a Class' for default $75/month", () => {
      render(<DonationForm />);
      // Default is $75/month
      expect(screen.getByText(/sponsor a class/i)).toBeInTheDocument();
    });

    it("shows 'Sponsor a Full Program' for $225/month", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(225));
      expect(screen.getByText(/sponsor a full program/i)).toBeInTheDocument();
    });

    it("shows 'Sponsor an Orphanage' for $675/month", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(675));
      expect(screen.getByText(/sponsor an orphanage/i)).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("disables submit button for amount less than $10", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Other amount (min $10)");
      await user.type(input, "5");

      expect(getSubmitButton()).toBeDisabled();
      expect(mockFetch).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
    });

    it("shows error for amount over $10,000", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Other amount (min $10)");
      await user.type(input, "20000");

      // The HTML5 max="10000" constraint blocks normal form submission,
      // so we use fireEvent.submit to bypass native validation
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(screen.getByText(/over \$10,000/i)).toBeInTheDocument();
      });
      expect(mockFetch).not.toHaveBeenCalledWith("/api/checkout", expect.anything());
    });

    it("clears error on new submit attempt", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Other amount (min $10)");
      await user.type(input, "20000");

      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(screen.getByText(/over \$10,000/i)).toBeInTheDocument();
      });

      // Now select a valid amount and submit
      await user.click(getPresetButton(75));
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.queryByText(/over \$10,000/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("sends correct payload for one-time donation", async () => {
      render(<DonationForm />);
      await user.click(screen.getByText("One-time"));
      await user.click(getPresetButton(150));
      await user.click(getSubmitButton());

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 150, frequency: "one_time" }),
      });
    });

    it("sends correct payload for monthly donation", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(225));
      await user.click(getSubmitButton());

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 225, frequency: "monthly" }),
      });
    });

    it("redirects to Stripe checkout on success", async () => {
      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(window.location.href).toBe("https://checkout.stripe.com/session_123");
      });
    });

    it("shows loading state during submission", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/payment-config") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ stripeEnabled: true, paypalEnabled: false }),
          });
        }
        return new Promise(() => {});
      });
      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText(/redirecting to checkout/i)).toBeInTheDocument();
      });
    });

    it("shows error when API returns an error", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/payment-config") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ stripeEnabled: true, paypalEnabled: false }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Something went wrong" }),
        });
      });

      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("shows error when fetch throws", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "/api/payment-config") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ stripeEnabled: true, paypalEnabled: false }),
          });
        }
        return Promise.reject(new Error("Network error"));
      });

      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });
});
