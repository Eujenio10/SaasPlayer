"use client";

import type { ProfileFeatureItem } from "@/lib/profile-features";

export function FeatureAccessGrid({ items }: { items: ProfileFeatureItem[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((f, i) => {
        const Icon = f.icon;
        return (
          <div
            key={`${f.title}-${i}`}
            className="rounded-2xl border border-[rgba(120,170,255,0.1)] bg-[#040B14]/50 p-4 transition hover:border-cyan-400/25"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-bold text-slate-100">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
