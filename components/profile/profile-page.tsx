"use client";

import { useCallback } from "react";
import type { UserAccessSummary } from "@/lib/auth/user-access";
import { profileFeaturesForRole } from "@/lib/profile-features";
import { AccountInfoCard } from "./account-info-card";
import { ProfileHeaderCard } from "./profile-header-card";
import { ProfileLayoutSidebar } from "./profile-layout-sidebar";
import { ProfileTopbar } from "./profile-topbar";
import { UserPlanCard } from "./user-plan-card";

export function ProfilePage({
  email,
  initialDisplayName,
  memberSinceLabel,
  organizationName,
  userAccess
}: {
  email: string;
  initialDisplayName: string;
  memberSinceLabel: string;
  organizationName: string;
  userAccess: UserAccessSummary;
}) {
  const features = profileFeaturesForRole(userAccess.role);

  const scrollToAccount = useCallback(() => {
    document.getElementById("account-info")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>("#account-info input[type=text]");
      el?.focus();
    }, 400);
  }, []);

  const parts = initialDisplayName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
      : (initialDisplayName.slice(0, 2) || "U").toUpperCase();

  return (
    <div className="min-h-screen bg-[#040B14]">
      <div className="relative mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#07111F] via-[#0A1628]/80 to-[#040B14]" />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <ProfileLayoutSidebar />

          <div className="min-w-0 flex-1 pb-12">
            <ProfileTopbar displayName={initialDisplayName} initials={initials} email={email} />

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Il mio profilo</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
              Gestisci il tuo account e visualizza il piano assegnato.
            </p>

            <div className="mt-8 space-y-8">
              <div>
                <ProfileHeaderCard
                  displayName={initialDisplayName}
                  email={email}
                  memberSinceLabel={memberSinceLabel}
                  organizationName={organizationName}
                  onEditClick={scrollToAccount}
                />
              </div>

              <UserPlanCard role={userAccess.role} features={features} />

              <AccountInfoCard initialFullName={initialDisplayName} email={email} />
            </div>

            <footer className="mt-12 border-t border-[rgba(120,170,255,0.1)] pt-6 text-center text-xs text-slate-500 sm:text-left">
              <p>Tactical Intelligence Hub © 2025 | IlDodicesimo</p>
              <p className="mt-1 text-[11px] text-slate-600">Piattaforma di Analisi Statistica ed Editoriale.</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
