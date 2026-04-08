import Link from "next/link";

export default function SuspendedPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <h1 className="text-3xl font-bold text-cyan-300">Servizio non disponibile</h1>
        <p className="mt-3 text-slate-300">
          L&apos;accesso ai monitor operativi e temporaneamente sospeso per questa
          organizzazione. Contatta l&apos;amministratore di riferimento.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-xl border border-cyan-300/40 px-4 py-2 text-cyan-200"
          >
            Torna al login
          </Link>
          <Link
            href="/"
            className="rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray"
          >
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
