"use client";

import { useState } from "react";

export function AllowlistThisIpButton({ nextPath }: { nextPath: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function run() {
    setState("loading");
    try {
      const res = await fetch("/api/security/allowlist-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      setState("done");
      window.location.href = nextPath;
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={state === "loading"}
      className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-darkGray disabled:opacity-60"
    >
      {state === "loading"
        ? "Autorizzo..."
        : state === "done"
          ? "Autorizzato"
          : state === "error"
            ? "Errore, riprova"
            : "Autorizza questo IP"}
    </button>
  );
}

