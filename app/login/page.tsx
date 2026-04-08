import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accesso B2B | Tactical Intelligence Hub"
};

export default function LoginPage({
  searchParams
}: {
  searchParams: { next?: string; error?: string };
}) {
  const nextPath = searchParams.next ?? "/display";
  const error = searchParams.error;

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg items-center">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <h1 className="text-3xl font-bold text-cyan-300">Accesso Operatore</h1>
        <p className="mt-3 text-slate-300">
          Inserisci credenziali autorizzate per entrare nell&apos;area monitor.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-cyan-400/30 bg-darkGray/70 px-3 py-2 text-sm text-cyan-200">
            Credenziali non valide o account non autorizzato.
          </p>
        ) : null}

        <form action="/auth/login" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Email aziendale</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-xl border border-cyan-400/30 bg-darkGray px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-xl border border-cyan-400/30 bg-darkGray px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray transition hover:brightness-110"
          >
            Accedi
          </button>
        </form>
      </div>
    </section>
  );
}
