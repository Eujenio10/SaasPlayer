import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Supabase invita spesso con redirect a Site URL: `/?code=...` (PKCE).
 * Senza questo passaggio, la home manderebbe subito a /login e l'invito non verrebbe mai completato.
 */
function buildAuthConfirmFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  const get = (key: string): string | undefined => {
    const v = searchParams[key];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return undefined;
  };

  const code = get("code");
  const tokenHash = get("token_hash") ?? get("token");
  const type = get("type");

  if (code) {
    const qs = new URLSearchParams();
    qs.set("code", code);
    qs.set("next", "/set-password");
    return `/auth/confirm?${qs.toString()}`;
  }

  if (tokenHash && type) {
    const qs = new URLSearchParams();
    qs.set("token_hash", tokenHash);
    qs.set("type", type);
    qs.set("next", "/set-password");
    return `/auth/confirm?${qs.toString()}`;
  }

  return null;
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const inviteContinue = buildAuthConfirmFromSearchParams(searchParams);
  if (inviteContinue) {
    redirect(inviteContinue);
  }

  const session = await getSessionContext();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.organization?.role === "admin";

  return (
    <section className="grid gap-8 py-10">
      <header className="rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <h1 className="text-4xl font-bold text-slate-100 md:text-5xl">
          Tactical Intelligence Hub
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-300">
          Hub editoriale B2B per analisi tattica calcistica in tempo reale, progettato
          per sale operative di agenzie sportive.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <>
            <span className="rounded-lg border border-cyan-400/40 px-3 py-1 text-sm text-cyan-200">
              Operatore: {session.email ?? "utente autenticato"}
            </span>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-cyan-400/40 px-3 py-1 text-sm text-cyan-200"
              >
                Disconnetti
              </button>
            </form>
          </>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/display"
          className="rounded-2xl border border-cyan-400/40 bg-darkGray p-6 transition hover:border-cyan-300"
        >
          <h2 className="text-2xl font-semibold text-cyan-300">/display Tactical TV</h2>
          <p className="mt-2 text-slate-300">
            Serie A: heatmap degli scontri e top tiratori (ultime 2) solo per le partite del giorno, carosello
            automatico. Per vetrina: pulsante &quot;schermo intero&quot; o link dedicato{" "}
            <span className="text-cyan-200">/display?vetrina=1</span>.
          </p>
        </Link>
        {isAdmin ? (
          <Link
            href="/kiosk"
            className="rounded-2xl border border-cyan-400/40 bg-darkGray p-6 transition hover:border-cyan-300"
          >
            <h2 className="text-2xl font-semibold text-cyan-300">/kiosk Interactive</h2>
            <p className="mt-2 text-slate-300">
              Modalita desktop interna con confronto 1 vs 1 tra giocatori (tutte le leghe).
            </p>
          </Link>
        ) : null}
        <Link
          href="/kiosk/hybrid"
          className="rounded-2xl border border-emerald-400/40 bg-darkGray p-6 transition hover:border-emerald-300"
        >
          <h2 className="text-2xl font-semibold text-emerald-300">/kiosk/hybrid</h2>
          <p className="mt-2 text-slate-300">
            Serie B nel menu con solo statistiche squadra; analisi giocatori e heatmap per Serie A, Champions ed
            Europa League; altre leghe solo statistiche di squadra.
          </p>
        </Link>
        {isAdmin ? (
          <Link
            href="/kiosk-testing"
            className="rounded-2xl border border-amber-400/40 bg-darkGray p-6 transition hover:border-amber-300"
          >
            <h2 className="text-2xl font-semibold text-amber-300">/kiosk-testing</h2>
            <p className="mt-2 text-slate-300">
              Test mirato su PSG vs Tolosa per verificare estrazione e mapping dati con meno chiamate API.
            </p>
          </Link>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="grid gap-4">
          <Link
            href="/admin/subscriptions"
            className="rounded-2xl border border-cyan-400/40 bg-darkGray p-6 transition hover:border-cyan-300"
          >
            <h2 className="text-2xl font-semibold text-cyan-300">/admin/subscriptions</h2>
            <p className="mt-2 text-slate-300">
              Pannello amministrativo per attivazione, sospensione e rinnovo manuale
              dell&apos;abbonamento tramite bonifico.
            </p>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
