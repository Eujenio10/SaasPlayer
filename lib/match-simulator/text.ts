export const MATCH_SIMULATOR_PAGE_TITLE = "Simulatore match";

export const MATCH_SIMULATOR_PAGE_SUBTITLE =
  "Simula lo scenario statistico della partita sulla base del rendimento e dello stile di gioco delle due squadre.";

export const MATCH_SIMULATOR_METHOD_NOTE =
  "La simulazione usa xG FootAPI (se disponibile), medie reali delle squadre e calibrazione su partite già giocate. Mediana e range P25–P75 sono più rappresentativi della media.";

export const MATCH_SIMULATOR_METHOD_EXPLANATION =
  "Il modello combina xG, i profili offensivi e difensivi delle due squadre e la calibrazione sulle partite già giocate, per avvicinare le medie simulate ai valori reali.";

export const MATCH_SIMULATOR_MONTE_CARLO_EXPLANATION =
  "La partita analizzata viene simulata 10.000 volte con i dati disponibili.";

export const MATCH_SIMULATOR_SCORE_NOTE =
  "I punteggi elencati sono quelli emersi con maggiore frequenza nelle 10.000 simulazioni, calcolate con i dati disponibili.";

export const MATCH_SIMULATOR_EMPTY_STATE =
  "Dati insufficienti per generare una simulazione affidabile di questa partita.";

export const MATCH_SIMULATOR_DB_NOT_READY =
  "Il database del simulatore non è ancora disponibile. Applica la migration Supabase e aggiorna i dati.";

export const MATCH_SIMULATOR_LOAD_ERROR = "Impossibile caricare il simulatore di partita.";

export function formatModelVersionLabel(modelVersion: string): string {
  const match = modelVersion.match(/v([\d.]+)/i);
  return match ? `Versione ${match[1]}` : modelVersion;
}

export function metricLabelIt(metric: string): string {
  switch (metric) {
    case "goals":
      return "Gol attesi";
    case "shots":
      return "Tiri";
    case "shotsOnTarget":
      return "Tiri in porta";
    case "corners":
      return "Corner";
    case "offsides":
      return "Fuorigioco";
    case "saves":
      return "Parate";
    case "possession":
      return "Possesso palla";
    case "fouls":
      return "Falli";
    case "yellowCards":
      return "Cartellini gialli";
    default:
      return metric;
  }
}

export function formatExpected(value: number | null | undefined, metric: string): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  if (metric === "goals") return value.toFixed(2);
  if (metric === "possession") return Math.round(value).toString();
  if (metric === "yellowCards" || metric === "offsides") return value.toFixed(1);
  return value.toFixed(1);
}

export function formatRange(
  min: number | null | undefined,
  max: number | null | undefined,
  metric: string
): string {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return "n/d";
  if (metric === "possession") return `${Math.round(min)}–${Math.round(max)}`;
  if (metric === "goals") return `${min.toFixed(1)}–${max.toFixed(1)}`;
  return `${min.toFixed(0)}–${max.toFixed(0)}`;
}
