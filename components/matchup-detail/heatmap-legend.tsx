interface HeatmapLegendProps {
  labelA: string;
  labelB: string;
  className?: string;
}

export function HeatmapLegend({ labelA, labelB, className = "" }: HeatmapLegendProps) {
  const shortA = labelA.split(" ").slice(-1)[0];
  const shortB = labelB.split(" ").slice(-1)[0];

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#94A3B8] ${className}`}>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#0EA5E9] shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
        Zona prevalentemente {shortA}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.45)]" />
        Zona prevalentemente {shortB}
      </span>
      <span className="hidden h-4 w-px bg-white/15 sm:inline-block" aria-hidden />
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#DC2626]" />
        Sovrapposizione massima
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#EA580C]" />
        Sovrapposizione media
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm bg-[#22C55E]" />
        Sovrapposizione sporadica
      </span>
    </div>
  );
}
