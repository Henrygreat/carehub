"use client";

import { useEffect, useState } from "react";
import { PasswordResetConfirmForm } from "@/components/auth-forms";

export function ResetPasswordClient() {
  const [token, setToken] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const resetToken = fragment.get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setToken(resetToken));
  }, []);

  if (!token) {
    return <p className="text-sm text-rose-700">This reset link is missing or invalid.</p>;
  }
  return <PasswordResetConfirmForm token={token} />;
}
