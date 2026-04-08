"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToMenu({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const href = `/?from=${encodeURIComponent(pathname ?? "/")}`;

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-slate-950/70 px-3 py-2 text-xs font-semibold tracking-wide text-cyan-200 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur hover:border-cyan-300 hover:bg-slate-950/85 ${className}`}
    >
      <span aria-hidden>←</span>
      <span>Menu</span>
    </Link>
  );
}

