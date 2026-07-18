import { MatchRadarHomeSection } from "@/components/match-radar/match-radar-home-section";
import { MATCH_RADAR_UI_TEXT } from "@/lib/match-radar/text";

export default function KioskMatchRadarPage() {
  const ui = MATCH_RADAR_UI_TEXT.it;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-black text-white">{ui.title}</h1>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-400">{ui.screenIntro}</p>
      <MatchRadarHomeSection isPro />
    </main>
  );
}
