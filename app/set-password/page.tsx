import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordClient } from "./set-password-client";

export const metadata: Metadata = {
  title: "Set password | PitchBrain"
};

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
          <p className="text-slate-300">Loading…</p>
        </section>
      }
    >
      <SetPasswordClient />
    </Suspense>
  );
}
