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
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountPlan, setNewAccountPlan] =
    useState<(typeof SUBSCRIPTION_PLANS)[number]["value"]>("prova");
  const [newAccountAdminEmail, setNewAccountAdminEmail] = useState("");
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

  async function createAccountGroup() {
    const response = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newAccountName,
        allowedIp: "127.0.0.1",
        allowedIpRanges: ["127.0.0.1/32"],
        initialPlan: newAccountPlan,
        additionalAdminEmail: newAccountAdminEmail || undefined
      })
    });

    if (!response.ok) {
      setMessage("Creazione account non riuscita. Verifica i dati inseriti.");
      return;
    }

    const json = (await response.json()) as { organizationId: string };
    setMessage("Nuovo account creato con successo.");
    const next = new URLSearchParams(searchParams.toString());
    next.set("organizationId", json.organizationId);
    router.push(`${pathname}?${next.toString()}`);
    router.refresh();
  }

  return (
    <section className="space-y-6 rounded-2xl border border-cyan-300/30 bg-graphite/80 p-6">
      <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-darkGray/50 p-4">
        <h2 className="text-2xl font-bold text-cyan-300">Registra Nuovo Account</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Nome account / gruppo</span>
            <input
              type="text"
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Piano iniziale</span>
            <select
              value={newAccountPlan}
              onChange={(event) =>
                setNewAccountPlan(
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
            value={newAccountAdminEmail}
            onChange={(event) => setNewAccountAdminEmail(event.target.value)}
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !newAccountName}
          onClick={() =>
            startTransition(() => {
              void createAccountGroup();
            })
          }
          className="rounded-xl bg-techBlue px-4 py-2 font-semibold text-darkGray"
        >
          Crea Account
        </button>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-cyan-300">Gestione Abbonamento</h2>
        <label className="mt-3 block space-y-2">
          <span className="text-sm text-slate-300">Account selezionato</span>
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
