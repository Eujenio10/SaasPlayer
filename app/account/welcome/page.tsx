import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountWelcomeClient } from "@/components/account/account-welcome-client";

export const metadata: Metadata = {
  title: "Account ready | PitchBrain"
};

export default function AccountWelcomePage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
          <p className="text-slate-300">Loading…</p>
        </section>
      }
    >
      <AccountWelcomeClient />
    </Suspense>
  );
}
