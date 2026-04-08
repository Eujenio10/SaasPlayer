"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminOrganizationOption } from "@/lib/auth/organization";
import { PLAN_DURATIONS, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

interface AdminSubscriptionPanelProps {
  status: string | null;
  currentPeriodEnd: string | null;
  plan: string | null;
  organizations: AdminOrganizationOption[];
  selectedOrganizationId: string;
}

export function AdminSubscriptionPanel({
  status,
  currentPeriodEnd,
  plan,
  organizations,
  selectedOrganizationId
}: AdminSubscriptionPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [planValue, setPlanValue] = useState<(typeof SUBSCRIPTION_PLANS)[number]["value"]>(
    SUBSCRIPTION_PLANS.some((item) => item.value === plan)
      ? (plan as (typeof SUBSCRIPTION_PLANS)[number]["value"])
      : "mensile"
  );
  const [suspendReason, setSuspendReason] = useState("");
  const [newAgencyName, setNewAgencyName] = useState("");
  const [newAgencyAllowedIp, setNewAgencyAllowedIp] = useState("127.0.0.1");
  const [newAgencyAllowedRanges, setNewAgencyAllowedRanges] = useState("127.0.0.1/32");
  const [newAgencyPlan, setNewAgencyPlan] =
    useState<(typeof SUBSCRIPTION_PLANS)[number]["value"]>("prova");
  const [newAgencyAdminEmail, setNewAgencyAdminEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function callAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setMessage("Operazione non riuscita. Verifica permessi e dati.");
      return;
    }

    setMessage("Operazione completata. Ricarica la pagina per stato aggiornato.");
  }

  async function createAgency() {
    const ranges = newAgencyAllowedRanges
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const response = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newAgencyName,
        allowedIp: newAgencyAllowedIp,
        allowedIpRanges: ranges,
        initialPlan: newAgencyPlan,
        additionalAdminEmail: newAgencyAdminEmail || undefined
      })
    });

    if (!response.ok) {
      setMessage("Creazione agenzia non riuscita. Verifica i dati inseriti.");
      return;
    }

    const json = (await response.json()) as { organizationId: string };
    setMessage("Nuova agenzia creata con successo.");
    const next = new URLSearchParams(searchParams.toString());
    next.set("organizationId", json.organizationId);
    router.push(`${pathname}?${next.toString()}`);
    router.refresh();
  }

  return (
    <section className="space-y-6 rounded-2xl border border-cyan-300/30 bg-graphite/80 p-6">
      <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-darkGray/50 p-4">
        <h2 className="text-2xl font-bold text-cyan-300">Registra Nuova Agenzia</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Nome agenzia</span>
            <input
              type="text"
              value={newAgencyName}
              onChange={(event) => setNewAgencyName(event.target.value)}
              className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">IP primario consentito</span>
            <input
              type="text"
              value={newAgencyAllowedIp}
              onChange={(event) => setNewAgencyAllowedIp(event.target.value)}
              className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Range IP (CSV)</span>
            <input
              type="text"
              value={newAgencyAllowedRanges}
              onChange={(event) => setNewAgencyAllowedRanges(event.target.value)}
              className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Piano iniziale</span>
            <select
              value={newAgencyPlan}
              onChange={(event) =>
                setNewAgencyPlan(
                  event.target.value as (typeof SUBSCRIPTION_PLANS)[number]["value"]
                )
              }
              className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
            >
              {SUBSCRIPTION_PLANS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-slate-300">Email admin aggiuntivo (opzionale)</span>
          <input
            type="email"
            value={newAgencyAdminEmail}
            onChange={(event) => setNewAgencyAdminEmail(event.target.value)}
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !newAgencyName}
          onClick={() =>
            startTransition(() => {
              void createAgency();
            })
          }
          className="rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray"
        >
          Crea Agenzia
        </button>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-cyan-300">Gestione Abbonamento</h2>
        <label className="mt-3 block space-y-2">
          <span className="text-sm text-slate-300">Centro selezionato</span>
          <select
            value={selectedOrganizationId}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams.toString());
              next.set("organizationId", event.target.value);
              router.push(`${pathname}?${next.toString()}`);
            }}
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
          >
            {organizations.map((org) => (
              <option key={org.organizationId} value={org.organizationId}>
                {org.organizationName}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-300">
          Stato attuale: <span className="text-cyan-200">{status ?? "non configurato"}</span>
        </p>
        <p className="text-sm text-slate-300">
          Scadenza: <span className="text-cyan-200">{currentPeriodEnd ?? "n/d"}</span>
        </p>
        <p className="text-sm text-slate-300">
          Piano: <span className="text-cyan-200">{plan ?? "n/d"}</span>
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-slate-300">Piano</span>
        <select
          value={planValue}
          onChange={(event) =>
            setPlanValue(
              event.target.value as (typeof SUBSCRIPTION_PLANS)[number]["value"]
            )
          }
          className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
        >
          {SUBSCRIPTION_PLANS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">
          Durata associata automaticamente: {PLAN_DURATIONS[planValue]} giorni.
        </p>
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void callAction({
                action: "activate",
                targetOrganizationId: selectedOrganizationId,
                plan: planValue
              });
            })
          }
          className="rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray"
        >
          Attiva
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void callAction({
                action: "renew",
                targetOrganizationId: selectedOrganizationId,
                plan: planValue
              });
            })
          }
          className="rounded-xl border border-cyan-300/40 px-4 py-2 text-cyan-200"
        >
          Rinnova
        </button>
      </div>

      <div className="space-y-2 border-t border-cyan-400/20 pt-4">
        <label className="space-y-2 block">
          <span className="text-sm text-slate-300">Motivo sospensione (opzionale)</span>
          <input
            type="text"
            value={suspendReason}
            onChange={(event) => setSuspendReason(event.target.value)}
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              void callAction({
                action: "suspend",
                targetOrganizationId: selectedOrganizationId,
                reason: suspendReason
              });
            })
          }
          className="rounded-xl border border-cyan-300/40 px-4 py-2 text-cyan-200"
        >
          Sospendi
        </button>
      </div>

      {message ? (
        <p className="rounded-xl border border-cyan-400/30 bg-darkGray/70 px-3 py-2 text-sm text-cyan-200">
          {message}
        </p>
      ) : null}
    </section>
  );
}
