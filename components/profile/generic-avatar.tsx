"use client";

export function GenericAvatar({
  initials,
  size = "md",
  className = ""
}: {
  initials: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "h-9 w-9 text-[10px]"
      : size === "md"
        ? "h-12 w-12 text-xs"
        : size === "lg"
          ? "h-16 w-16 text-sm"
          : "h-24 w-24 text-xl";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(120,170,255,0.22)] bg-gradient-to-br from-slate-700/80 to-slate-900/90 font-black uppercase tracking-tight text-slate-100 shadow-inner ${dim} ${className}`}
      aria-hidden
    >
      {initials.slice(0, 3)}
    </span>
  );
}
