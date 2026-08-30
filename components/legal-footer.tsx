const LEGAL_DISCLAIMER =
  "PitchBrain fornisce analisi statistiche sportive a fini esclusivamente informativi. Non fornisce quote, consigli di scommessa, indicazioni di puntata o servizi relativi al gioco con vincite in denaro.";

export function LegalFooter() {
  return (
    <footer className="legal-footer px-4 py-3 text-xs md:text-sm">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-2">
        <p className="text-center leading-relaxed text-slate-400">
          {LEGAL_DISCLAIMER}
        </p>
      </div>
      <p className="sr-only">{LEGAL_DISCLAIMER}</p>
    </footer>
  );
}
