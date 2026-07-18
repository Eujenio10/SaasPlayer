import type { MatchRadarEmptyReason, MatchRadarReason } from "@/lib/match-radar/types";

function p(params: Record<string, string | number> | undefined, key: string): string {
  const value = params?.[key];
  return value != null ? String(value) : "";
}

export const MATCH_RADAR_REASON_TEXT: Record<
  "it" | "en",
  Record<string, (params?: Record<string, string | number>) => string>
> = {
  it: {
    high_foul_interaction: (params) =>
      `${p(params, "homeTeam")} commette molti falli (${p(params, "homeFoulsPct")}° percentile) e ${p(params, "awayTeam")} ne subisce spesso (${p(params, "awayDrawnPct")}°): il modello prevede una partita fisica.`,
    high_foul_interaction_away: (params) =>
      `${p(params, "awayTeam")} pressa con falli frequenti mentre ${p(params, "homeTeam")} subisce contatti (${p(params, "homeDrawnPct")}° percentile): elevata probabilità di interruzioni di gioco.`,
    elevated_card_frequency: (params) =>
      `Entrambe le squadre stanno ricevendo cartellini sopra la media recente: ${p(params, "homeTeam")} ${p(params, "homeCardsAvg")}/partita e ${p(params, "awayTeam")} ${p(params, "awayCardsAvg")}/partita (indice ${p(params, "cardsPct")}/100). Contesto disciplinare teso.`,
    strict_referee_profile: (params) =>
      `Arbitro designato con profilo severo: in media ${p(params, "foulsPerMatch")} falli e ${p(params, "yellowPerMatch")} gialli a partita (${p(params, "foulsVsCompetitionPct")}% e ${p(params, "yellowVsCompetitionPct")}% rispetto alla media del torneo, ${p(params, "sample")} gare). Segnale positivo per intensità e cartellini.`,
    both_teams_high_foul_average: (params) =>
      `${p(params, "homeTeam")} (${p(params, "homeFoulsAvg")} falli/partita) e ${p(params, "awayTeam")} (${p(params, "awayFoulsAvg")} falli/partita) hanno medie elevate di falli commessi: partita fisica attesa.`,
    physical_disciplinary_clash: (params) =>
      `Scontro fisico-disciplinare: ${p(params, "homeTeam")} e ${p(params, "awayTeam")} combinano medie alte di falli (${p(params, "homeFoulsAvg")} e ${p(params, "awayFoulsAvg")}) e cartellini (${p(params, "homeCardsAvg")} e ${p(params, "awayCardsAvg")}) nelle ultime gare.`,
    elevated_offside_activity: (params) =>
      `Entrambe le squadre vivono linee alte e pressing: ${p(params, "homeTeam")} ${p(params, "homeOffsidesAvg")} fuorigioco/partita, ${p(params, "awayTeam")} ${p(params, "awayOffsidesAvg")} (indice ${p(params, "offsidesPct")}/100).`,
    long_range_shooting_volume: (params) =>
      `Volume elevato di tiri da fuori area: ${p(params, "homeTeam")} ${p(params, "homeOutsideAvg")}/partita e ${p(params, "awayTeam")} ${p(params, "awayOutsideAvg")}/partita (indice ${p(params, "outsidePct")}/100).`,
    home_long_range_threat: (params) =>
      `${p(params, "homeTeam")} tira spesso da lontano (${p(params, "homeOutsideAvg")} tiri fuori area/partita) contro una ${p(params, "awayTeam")} che concede tiri esterni (${p(params, "awayOutsideAvg")}/partita).`,
    away_long_range_threat: (params) =>
      `${p(params, "awayTeam")} punta molto da fuori area (${p(params, "awayOutsideAvg")}/partita) contro una ${p(params, "homeTeam")} che subisce tiri lontani (${p(params, "homeOutsideAvg")}/partita).`,
    high_attacking_volume: (params) =>
      `${p(params, "homeTeam")} e ${p(params, "awayTeam")} producono un volume di tiri superiore alla media del campionato (indice ${p(params, "shotsPct")}/100).`,
    above_average_offensive_profile: (params) =>
      `Il profilo offensivo combinato di ${p(params, "homeTeam")} e ${p(params, "awayTeam")} è sopra la media della competizione: molte situazioni create di recente.`,
    teams_statistically_close: (params) =>
      `${p(params, "homeTeam")} e ${p(params, "awayTeam")} presentano valori recenti molto simili: partita statisticamente equilibrata e difficile da separare.`,
    high_recent_variability: (params) =>
      `Le ultime prestazioni di ${p(params, "homeTeam")} e ${p(params, "awayTeam")} oscillano molto: alta variabilità statistica nel campione recente.`,
    corner_pressure_mismatch: (params) =>
      `${p(params, "homeTeam")} genera molti corner contro una ${p(params, "awayTeam")} che ne concede spesso: contrasto utile sulle fasce e sui calci piazzati.`,
    statistical_style_contrast: (params) =>
      `Il modello rileva un contrasto netto tra ciò che ${p(params, "homeTeam")} produce e ciò che ${p(params, "awayTeam")} concede (o viceversa).`,
    elevated_match_intensity: (params) =>
      `Complessivamente ${p(params, "homeTeam")}–${p(params, "awayTeam")} presenta un'elevata intensità statistica attesa su falli, cartellini e volume di gioco.`
  },
  en: {
    high_foul_interaction: (params) =>
      `${p(params, "homeTeam")} commits many fouls (${p(params, "homeFoulsPct")}th percentile) and ${p(params, "awayTeam")} often draws contact (${p(params, "awayDrawnPct")}th): the model expects a physical match.`,
    high_foul_interaction_away: (params) =>
      `${p(params, "awayTeam")} presses with frequent fouls while ${p(params, "homeTeam")} draws fouls (${p(params, "homeDrawnPct")}th percentile): many stoppages likely.`,
    elevated_card_frequency: (params) =>
      `Both teams are picking up cards above their recent average: ${p(params, "homeTeam")} ${p(params, "homeCardsAvg")}/match and ${p(params, "awayTeam")} ${p(params, "awayCardsAvg")}/match (index ${p(params, "cardsPct")}/100).`,
    strict_referee_profile: (params) =>
      `Appointed referee with a strict profile: averages ${p(params, "foulsPerMatch")} fouls and ${p(params, "yellowPerMatch")} yellows per match (${p(params, "foulsVsCompetitionPct")}% and ${p(params, "yellowVsCompetitionPct")}% vs tournament average, ${p(params, "sample")} games). Positive signal for intensity and cards.`,
    both_teams_high_foul_average: (params) =>
      `${p(params, "homeTeam")} (${p(params, "homeFoulsAvg")} fouls/match) and ${p(params, "awayTeam")} (${p(params, "awayFoulsAvg")} fouls/match) both commit fouls at an elevated rate: a physical match is expected.`,
    physical_disciplinary_clash: (params) =>
      `Physical-disciplinary clash: ${p(params, "homeTeam")} and ${p(params, "awayTeam")} combine high foul averages (${p(params, "homeFoulsAvg")} and ${p(params, "awayFoulsAvg")}) and card rates (${p(params, "homeCardsAvg")} and ${p(params, "awayCardsAvg")}) recently.`,
    elevated_offside_activity: (params) =>
      `Both teams play high lines: ${p(params, "homeTeam")} ${p(params, "homeOffsidesAvg")} offsides/match, ${p(params, "awayTeam")} ${p(params, "awayOffsidesAvg")} (index ${p(params, "offsidesPct")}/100).`,
    long_range_shooting_volume: (params) =>
      `High volume of shots from outside the box: ${p(params, "homeTeam")} ${p(params, "homeOutsideAvg")}/match and ${p(params, "awayTeam")} ${p(params, "awayOutsideAvg")}/match (index ${p(params, "outsidePct")}/100).`,
    home_long_range_threat: (params) =>
      `${p(params, "homeTeam")} shoots often from distance (${p(params, "homeOutsideAvg")} outside-box shots/match) against ${p(params, "awayTeam")} conceding long-range attempts (${p(params, "awayOutsideAvg")}/match).`,
    away_long_range_threat: (params) =>
      `${p(params, "awayTeam")} threatens from outside the box (${p(params, "awayOutsideAvg")}/match) against ${p(params, "homeTeam")} allowing long shots (${p(params, "homeOutsideAvg")}/match).`,
    high_attacking_volume: (params) =>
      `${p(params, "homeTeam")} and ${p(params, "awayTeam")} produce an above-average shot volume (index ${p(params, "shotsPct")}/100).`,
    above_average_offensive_profile: (params) =>
      `The combined offensive profile of ${p(params, "homeTeam")} and ${p(params, "awayTeam")} is above the competition average.`,
    teams_statistically_close: (params) =>
      `${p(params, "homeTeam")} and ${p(params, "awayTeam")} have very similar recent metrics: a statistically balanced matchup.`,
    high_recent_variability: (params) =>
      `Recent performances by ${p(params, "homeTeam")} and ${p(params, "awayTeam")} swing widely: high statistical variability.`,
    corner_pressure_mismatch: (params) =>
      `${p(params, "homeTeam")} creates many corners against a ${p(params, "awayTeam")} that frequently concedes them.`,
    statistical_style_contrast: (params) =>
      `The model detects a clear contrast between what ${p(params, "homeTeam")} produces and what ${p(params, "awayTeam")} allows.`,
    elevated_match_intensity: (params) =>
      `Overall ${p(params, "homeTeam")} vs ${p(params, "awayTeam")} shows elevated expected statistical intensity.`
  }
};

export const MATCH_RADAR_UI_TEXT = {
  it: {
    title: "Match Radar",
    subtitle: "Le partite più interessanti secondo i dati",
    screenIntro:
      "Match Radar ordina le partite future usando statistiche recenti di squadre e arbitro. Ogni punteggio spiega perché una gara merita attenzione analitica.",
    homeCtaTitle: "Scopri Match Radar",
    homeCtaBody:
      "Partite future classificate per intensità, potenziale offensivo, equilibrio e profilo arbitrale — con motivazioni leggibili.",
    homeCtaButton: "Apri Match Radar",
    whyTitle: "Perché è in evidenza",
    refereeSectionTitle: "Profilo arbitrale designato",
    refereePending:
      "Arbitro non ancora designato da FootApi per questa partita. Il profilo arbitrale comparirà quando sarà disponibile.",
    refereeBoostNote: (boost: number) =>
      `Profilo arbitrale severo: +${boost} punti sul punteggio Match Radar (più falli e cartellini del normale).`,
    refereeVsCompetitionNote: (foulsPct: number, yellowPct: number) =>
      `${foulsPct}% falli e ${yellowPct}% gialli rispetto alla media del torneo — profilo favorevole per intensità e cartellini.`,
    matchupInsightsTitle: "Confronto statistico",
    statGoalsFor: "Gol fatti / partita",
    statGoalsAgainst: "Gol subiti / partita",
    statShotsFor: "Tiri / partita",
    statFoulsCommitted: "Falli commessi / partita",
    statFoulsSuffered: "Falli subiti / partita",
    statCards: "Cartellini / partita",
    statOffsides: "Fuorigioco / partita",
    statShotsOutsideBox: "Tiri fuori area / partita",
    statCornersFor: "Corner / partita",
    statPoints: "Punti / partita",
    matchupSampleNote: (homeN: number, awayN: number) =>
      `Medie sulle ultime partite del torneo (campione: ${homeN} e ${awayN} gare).`,
    modes: {
      general: "In evidenza",
      intensity: "Più intense",
      attacking: "Potenziale offensivo",
      balance: "Più equilibrate",
      volatility: "Più imprevedibili"
    },
    confidence: {
      low: "Affidabilità bassa",
      medium: "Affidabilità media",
      high: "Affidabilità alta"
    },
    dimensions: {
      intensity: "Intensità",
      attackingPotential: "Potenziale offensivo",
      balance: "Equilibrio",
      volatility: "Variabilità",
      tacticalMismatch: "Contrasto statistico",
      refereeStrictness: "Profilo arbitrale"
    },
    empty: "Nessuna partita Match Radar disponibile per questa giornata.",
    emptyMigration:
      "Match Radar non è ancora attivo sul database. Applica la migration Supabase e riavvia il server.",
    emptyNotComputed:
      "I punteggi non sono ancora stati calcolati. Un admin deve eseguire «Aggiorna dati partite» dalla home.",
    emptyToday:
      "Nessuna partita analizzata per oggi. Le prossime partite monitorate compariranno dopo l'aggiornamento dati.",
    emptyWindow:
      "Nessuna partita Match Radar nei prossimi 14 giorni. Verifica che l'admin abbia aggiornato i dati.",
    subtitleLookahead: "Le partite più interessanti nei prossimi giorni monitorati",
    loading: "Caricamento Match Radar…",
    error: "Impossibile caricare Match Radar.",
    limitedPreview: "Anteprima limitata — passa a Pro per l'analisi completa.",
    radarScore: "Match Radar",
    unavailable: "Non disponibile"
  },
  en: {
    title: "Match Radar",
    subtitle: "The most interesting matches according to the data",
    screenIntro:
      "Match Radar ranks upcoming fixtures using recent team and referee statistics. Each score explains why a match deserves analytical attention.",
    homeCtaTitle: "Discover Match Radar",
    homeCtaBody:
      "Upcoming matches ranked by intensity, attacking potential, balance and referee profile — with readable reasons.",
    homeCtaButton: "Open Match Radar",
    whyTitle: "Why it stands out",
    refereeSectionTitle: "Appointed referee profile",
    refereePending:
      "No referee assigned yet in FootApi for this fixture. The referee profile will appear once available.",
    refereeBoostNote: (boost: number) =>
      `Strict referee profile: +${boost} points on the Match Radar score (more fouls and cards than usual).`,
    refereeVsCompetitionNote: (foulsPct: number, yellowPct: number) =>
      `${foulsPct}% fouls and ${yellowPct}% yellows vs tournament average — positive signal for intensity and cards.`,
    matchupInsightsTitle: "Statistical matchup",
    statGoalsFor: "Goals scored / match",
    statGoalsAgainst: "Goals conceded / match",
    statShotsFor: "Shots / match",
    statFoulsCommitted: "Fouls committed / match",
    statFoulsSuffered: "Fouls drawn / match",
    statCards: "Cards / match",
    statOffsides: "Offsides / match",
    statShotsOutsideBox: "Shots outside box / match",
    statCornersFor: "Corners / match",
    statPoints: "Points / match",
    matchupSampleNote: (homeN: number, awayN: number) =>
      `Averages from recent tournament matches (sample: ${homeN} and ${awayN} games).`,
    modes: {
      general: "Featured",
      intensity: "Highest intensity",
      attacking: "Attacking potential",
      balance: "Most balanced",
      volatility: "Most unpredictable"
    },
    confidence: {
      low: "Low confidence",
      medium: "Medium confidence",
      high: "High confidence"
    },
    dimensions: {
      intensity: "Intensity",
      attackingPotential: "Attacking potential",
      balance: "Balance",
      volatility: "Variability",
      tacticalMismatch: "Statistical contrast",
      refereeStrictness: "Referee profile"
    },
    empty: "No Match Radar fixtures available for this day.",
    emptyMigration:
      "Match Radar is not active on the database yet. Apply the Supabase migration and restart the server.",
    emptyNotComputed:
      "Scores have not been computed yet. An admin must run «Refresh match data» from the home screen.",
    emptyToday:
      "No analysed fixtures for today. Upcoming monitored matches will appear after a data refresh.",
    emptyWindow:
      "No Match Radar fixtures in the next 14 days. Make sure an admin has refreshed the data.",
    subtitleLookahead: "The most interesting monitored fixtures in the coming days",
    loading: "Loading Match Radar…",
    error: "Unable to load Match Radar.",
    limitedPreview: "Limited preview — upgrade to Pro for the full analysis.",
    radarScore: "Match Radar",
    unavailable: "Unavailable"
  }
} as const;

export function translateMatchRadarReason(
  reason: MatchRadarReason,
  locale: "it" | "en"
): string {
  const fn = MATCH_RADAR_REASON_TEXT[locale][reason.key];
  return fn ? fn(reason.parameters) : reason.key;
}

export function matchRadarEmptyMessage(
  locale: "it" | "en",
  emptyReason: MatchRadarEmptyReason
): string {
  const ui = MATCH_RADAR_UI_TEXT[locale];
  switch (emptyReason) {
    case "migration_missing":
      return ui.emptyMigration;
    case "scores_not_computed":
      return ui.emptyNotComputed;
    case "no_matches_today":
      return ui.emptyToday;
    case "no_matches_in_window":
      return ui.emptyWindow;
    default:
      return ui.empty;
  }
}

export function resolveLocale(input?: string | null): "it" | "en" {
  if (input?.toLowerCase().startsWith("en")) return "en";
  return "it";
}
