import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account pronto | PitchBrain"
};

export default function AccountWelcomePage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300/80">PitchBrain</p>
        <h1 className="mt-2 text-3xl font-bold text-cyan-300">Account pronto</h1>
        <p className="mt-3 text-slate-300">
          Password impostata correttamente. Ora apri l&apos;app <strong>PitchBrain</strong> sul telefono,
          vai su <strong>Accedi</strong> e usa la stessa email e password.
        </p>
        <p className="mt-4 text-sm text-slate-400">
          Puoi chiudere questa pagina del browser.
        </p>
      </div>
    </section>
  );
}
