"use client";

import { useEffect, useState } from "react";

export function AuthGuestLanding() {
  const [message, setMessage] = useState("Caricamento…");

  useEffect(() => {
    if (window.location.hash.includes("access_token=")) {
      setMessage("Conferma account PitchBrain in corso…");
      return;
    }
    window.location.replace("/login");
  }, []);

  return (
    <section className="mx-auto flex min-h-[40vh] max-w-lg items-center px-4">
      <p className="text-slate-300">{message}</p>
    </section>
  );
}
