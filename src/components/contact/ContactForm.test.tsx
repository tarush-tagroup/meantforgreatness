import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "./ContactForm";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ContactForm", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  describe("rendering", () => {
    it("renders all form fields", () => {
      render(<ContactForm />);
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Message")).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<ContactForm />);
      expect(
        screen.getByRole("button", { name: /send message/i })
      ).toBeInTheDocument();
    });

    it("renders placeholders", () => {
      render(<ContactForm />);
      expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("How can we help?")
      ).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows error for empty name", async () => {
      render(<ContactForm />);
      await user.click(screen.getByRole("button", { name: /send message/i }));
      expect(screen.getByText(/enter your name/i)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows error for empty email", async () => {
      render(<ContactForm />);
      await user.type(screen.getByLabelText("Name"), "John");
      await user.click(screen.getByRole("button", { name: /send message/i }));
      expect(screen.getByText(/enter your email/i)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows error for empty message", async () => {
      render(<ContactForm />);
      await user.type(screen.getByLabelText("Name"), "John");
      await user.type(screen.getByLabelText("Email"), "john@example.com");
      await user.click(screen.getByRole("button", { name: /send message/i }));
      expect(screen.getByText(/enter a message/i)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("submission", () => {
    async function fillAndSubmit() {
      await user.type(screen.getByLabelText("Name"), "John Doe");
      await user.type(screen.getByLabelText("Email"), "john@example.com");
      await user.type(screen.getByLabelText("Message"), "Hello there!");
      await user.click(screen.getByRole("button", { name: /send message/i }));
    }

    it("sends correct payload", async () => {
      render(<ContactForm />);
      await fillAndSubmit();

      expect(mockFetch).toHaveBeenCalledWith("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "John Doe",
          email: "john@example.com",
          message: "Hello there!",
        }),
      });
    });

    it("shows success message after submission", async () => {
      render(<ContactForm />);
      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByText(/message sent/i)).toBeInTheDocument();
      });
    });

    it("shows loading state during submission", async () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      render(<ContactForm />);
      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByText(/sending/i)).toBeInTheDocument();
      });
    });

    it("shows error when API returns error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      render(<ContactForm />);
      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("shows error when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<ContactForm />);
      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });
});
