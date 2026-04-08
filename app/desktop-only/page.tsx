import Link from "next/link";

export default function DesktopOnlyPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <h1 className="text-3xl font-bold text-cyan-300">Accesso consentito solo da desktop</h1>
        <p className="mt-3 text-slate-300">
          Le modalita `/display`, `/kiosk` e `/kiosk/hybrid` sono riservate a monitor operativi fissi
          in ambiente professionale interno.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-xl border border-cyan-300/40 px-4 py-2 text-cyan-200"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </section>
  );
}
