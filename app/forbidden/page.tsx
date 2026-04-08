import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { AllowlistThisIpButton } from "@/components/allowlist-this-ip-button";

function safeNextPath(next?: string): string {
  const raw = (next ?? "").trim();
  if (!raw) return "/display";
  if (!raw.startsWith("/")) return "/display";
  if (raw.startsWith("//")) return "/display";
  return raw;
}

export default async function ForbiddenPage({
  searchParams
}: {
  searchParams?: { next?: string };
}) {
  const session = await getSessionContext();
  const nextPath = safeNextPath(searchParams?.next);

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <div className="w-full rounded-2xl border border-cyan-300/30 bg-graphite/80 p-8 shadow-broadcast">
        <h1 className="text-3xl font-bold text-cyan-300">Accesso non autorizzato</h1>
        <p className="mt-3 text-slate-300">
          L&apos;utenza autenticata non dispone dei permessi richiesti per questa
          area operativa.
        </p>
        {session?.organization?.role === "admin" ? (
          <div className="mt-5 rounded-xl border border-emerald-400/25 bg-slate-950/40 p-4">
            <p className="text-sm text-slate-300">
              Sei admin: puoi autorizzare automaticamente l&apos;IP corrente per la tua organizzazione.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <AllowlistThisIpButton nextPath={nextPath} />
              <Link
                href={nextPath}
                className="rounded-xl border border-slate-600/60 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Riprova
              </Link>
            </div>
          </div>
        ) : null}
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
