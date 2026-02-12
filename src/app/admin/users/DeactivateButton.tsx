"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeactivateButtonProps {
  userId: string;
  userName: string;
}

export default function DeactivateButton({
  userId,
  userName,
}: DeactivateButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDeactivate() {
    if (
      !confirm(
        `Are you sure you want to deactivate ${userName}? They will no longer be able to log in.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to deactivate user");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to deactivate user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDeactivate}
      disabled={loading}
      className="text-xs font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
    >
      {loading ? "..." : "Deactivate"}
    </button>
  );
}
