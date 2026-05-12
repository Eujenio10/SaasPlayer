import type { UserAccessRole } from "@/lib/auth/organization";
import type { LucideIcon } from "lucide-react";
import {
  Gauge,
  LayoutDashboard,
  RefreshCw,
  Shield,
  Swords,
  Table2,
  TriangleAlert
} from "lucide-react";

export interface ProfileFeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function profileFeaturesForRole(role: UserAccessRole): ProfileFeatureItem[] {
  const base: ProfileFeatureItem[] = [
    {
      icon: LayoutDashboard,
      title: "Dashboard completa",
      description: "Accesso alla home Tactical Intelligence Hub e ai moduli collegati al tuo account."
    },
    {
      icon: Swords,
      title: "Scontri in campo",
      description: "Confronti tattici e heatmap tra profili nella partita selezionata."
    },
    {
      icon: Gauge,
      title: "Rischio falli (commessi e subiti)",
      description: "Ranking e indicatori di rischio basati su medie stagionali e incrocio posizioni."
    },
    {
      icon: TriangleAlert,
      title: "Allarme ammonizioni",
      description:
        role === "member"
          ? "Classifiche con visibilità parziale alcune righe, come da policy del canale."
          : "Top profili e contesto partita sui campionati supportati."
    },
    {
      icon: Table2,
      title: "Report e viste tattiche",
      description: "Indicatori aggregati e testi descrittivi per contestualizzare i numeri."
    }
  ];

  if (role === "admin") {
    return [
      ...base.slice(0, 2),
      {
        icon: RefreshCw,
        title: "Aggiornamento dati",
        description:
          "Ricalcolo e sincronizzazione delle analisi sui match, riservato agli amministratori della piattaforma."
      },
      ...base.slice(2)
    ];
  }

  if (role === "member") {
    return [
      {
        icon: Shield,
        title: "Utilizzo partite a settimana",
        description:
          "Selezione di un numero massimo di partite da analizzare per settimana, come definito per gli account membro."
      },
      ...base
    ];
  }

  return base;
}

export function planLabelIt(role: UserAccessRole): string {
  if (role === "admin") return "Admin";
  if (role === "pro") return "Pro";
  return "Membro";
}
