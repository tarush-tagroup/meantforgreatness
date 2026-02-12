import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
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
  // The JSX `${preset}` renders $ and the number as separate text nodes.
  // Use getAllByRole to find all type="button" buttons, then filter by textContent.
  const buttons = screen.getAllByRole("button");
  const match = buttons.find(
    (btn) => btn.textContent?.trim() === `$${amount}` && btn.getAttribute("type") === "button"
  );
  if (!match) throw new Error(`Preset button $${amount} not found`);
  return match;
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /donate|redirecting/i });
}

describe("DonationForm", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://checkout.stripe.com/session_123" }),
    });
    window.location.href = "";
  });

  describe("rendering", () => {
    it("renders the form with frequency toggle", () => {
      render(<DonationForm />);
      expect(screen.getByText("One-time")).toBeInTheDocument();
      expect(screen.getByText("Monthly")).toBeInTheDocument();
    });

    it("renders preset amount buttons", () => {
      render(<DonationForm />);
      expect(getPresetButton(25)).toBeInTheDocument();
      expect(getPresetButton(50)).toBeInTheDocument();
      expect(getPresetButton(100)).toBeInTheDocument();
      expect(getPresetButton(250)).toBeInTheDocument();
    });

    it("renders custom amount input", () => {
      render(<DonationForm />);
      expect(screen.getByPlaceholderText("Custom amount")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<DonationForm />);
      expect(getSubmitButton()).toBeInTheDocument();
    });

    it("defaults to monthly and $50", () => {
      render(<DonationForm />);
      expect(getSubmitButton().textContent).toMatch(/Donate \$50\/month/);
    });
  });

  describe("amount selection", () => {
    it("selects a preset amount", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(100));
      expect(getSubmitButton().textContent).toMatch(/Donate \$100/);
    });

    it("switches to custom amount when typing", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Custom amount");
      await user.type(input, "75");
      expect(getSubmitButton().textContent).toMatch(/Donate \$75/);
    });

    it("switches back to preset after selecting custom", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Custom amount");
      await user.type(input, "75");
      await user.click(getPresetButton(25));
      expect(getSubmitButton().textContent).toMatch(/Donate \$25/);
    });
  });

  describe("frequency toggle", () => {
    it("switches to one-time", async () => {
      render(<DonationForm />);
      await user.click(screen.getByText("One-time"));
      const text = getSubmitButton().textContent!;
      expect(text).toMatch(/Donate \$50/);
      expect(text).not.toMatch(/\/month/);
    });

    it("switches back to monthly", async () => {
      render(<DonationForm />);
      await user.click(screen.getByText("One-time"));
      await user.click(screen.getByText("Monthly"));
      expect(getSubmitButton().textContent).toMatch(/Donate \$50\/month/);
    });
  });

  describe("sponsorship context messages", () => {
    it("shows 'Sponsor a Kid' for amounts >= $25", () => {
      render(<DonationForm />);
      // Default is $50
      expect(screen.getByText(/sponsor a kid/i)).toBeInTheDocument();
    });

    it("shows 'Sponsor Multiple Kids' for amounts >= $100", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(100));
      expect(screen.getByText(/sponsor multiple kids/i)).toBeInTheDocument();
    });

    it("shows 'Sponsor a Teacher' for amounts >= $250", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(250));
      expect(screen.getByText(/sponsor a teacher/i)).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("disables submit button for amount less than $1", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Custom amount");
      await user.type(input, "0.5");

      expect(getSubmitButton()).toBeDisabled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows error for amount over $10,000", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Custom amount");
      await user.type(input, "20000");

      // The HTML5 max="10000" constraint blocks normal form submission,
      // so we use fireEvent.submit to bypass native validation
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(screen.getByText(/over \$10,000/i)).toBeInTheDocument();
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("clears error on new submit attempt", async () => {
      render(<DonationForm />);
      const input = screen.getByPlaceholderText("Custom amount");
      await user.type(input, "20000");

      fireEvent.submit(input.closest("form")!);

      await waitFor(() => {
        expect(screen.getByText(/over \$10,000/i)).toBeInTheDocument();
      });

      // Now select a valid amount and submit
      await user.click(getPresetButton(50));
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
      await user.click(getPresetButton(100));
      await user.click(getSubmitButton());

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100, frequency: "one_time" }),
      });
    });

    it("sends correct payload for monthly donation", async () => {
      render(<DonationForm />);
      await user.click(getPresetButton(250));
      await user.click(getSubmitButton());

      expect(mockFetch).toHaveBeenCalledWith("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 250, frequency: "monthly" }),
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
      mockFetch.mockReturnValue(new Promise(() => {}));
      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText(/redirecting to checkout/i)).toBeInTheDocument();
      });
    });

    it("shows error when API returns an error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Something went wrong" }),
      });

      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("shows error when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<DonationForm />);
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });
});
