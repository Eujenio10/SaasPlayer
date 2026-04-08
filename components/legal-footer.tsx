import Link from "next/link";

const LEGAL_DISCLAIMER =
  "Tactical Intelligence Hub: Piattaforma di Analisi Statistica ed Editoriale. No Betting. No Induzione al gioco.";

export function LegalFooter() {
  return (
    <footer className="legal-footer px-4 py-3 text-xs md:text-sm">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-2">
        <div className="flex flex-wrap justify-center gap-3 text-cyan-200/90">
          <Link href="/legal/privacy" className="hover:text-cyan-300">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-cyan-300">
            Termini B2B
          </Link>
          <Link href="/legal/data-processing" className="hover:text-cyan-300">
            Trattamento Dati
          </Link>
        </div>
        <p className="text-center leading-relaxed">
          {LEGAL_DISCLAIMER}
        </p>
      </div>
      <p className="sr-only">
        {LEGAL_DISCLAIMER}
      </p>
    </footer>
  );
}
