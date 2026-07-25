"use client";

import { useEffect } from "react";

/** Se Supabase manda l'invito alla Site URL (/) con token nel fragment, reindirizza al callback PitchBrain. */
export function AuthInviteHashBridge() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;
    window.location.replace(`/auth/callback?next=${encodeURIComponent("/set-password")}${hash}`);
  }, []);

  return null;
}
