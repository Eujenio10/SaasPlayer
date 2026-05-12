"use client";

import { useEffect, useRef, useState } from "react";

export function AccountInfoCard({
  initialFullName,
  email
}: {
  initialFullName: string;
  email: string;
}) {
  const [name, setName] = useState(initialFullName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialFullName);
  }, [initialFullName]);

  async function save() {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name.trim() })
      });
      if (!res.ok) {
        setMsg("Impossibile salvare. Verifica il nome inserito.");
        return;
      }
      setMsg("Nome aggiornato.");
    } catch {
      setMsg("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="account-info" className="rounded-[1.35rem] border border-[rgba(120,170,255,0.12)] bg-[rgba(8,16,32,0.92)] p-6 sm:p-8">
      <h2 className="text-lg font-black text-white">Informazioni account</h2>
      <p className="mt-1 text-sm text-slate-500">Nome e indirizzo collegati al tuo accesso Tactical Intelligence Hub.</p>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome completo</span>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full max-w-xl rounded-xl border border-[rgba(120,170,255,0.15)] bg-[#040B14]/80 px-4 py-3 text-sm text-slate-100 outline-none ring-0 transition placeholder:text-slate-600 focus:border-cyan-400/40"
            maxLength={120}
            autoComplete="name"
          />
        </label>

        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
          <p className="mt-2 rounded-xl border border-[rgba(120,170,255,0.08)] bg-[#040B14]/50 px-4 py-3 text-sm text-slate-300">
            {email}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">L&apos;email è gestita dall&apos;amministratore; non modificabile da questa schermata.</p>
        </div>

        {msg ? <p className="text-sm text-cyan-200/90">{msg}</p> : null}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || name.trim().length < 2}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Salvataggio…" : "Salva nome"}
        </button>
      </div>
    </section>
  );
}
