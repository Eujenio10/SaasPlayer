import type { MatchRadarEmptyReason, MatchRadarReason } from "@/lib/match-radar/types";

function p(params: Record<string, string | number> | undefined, key: string): string {
  const value = params?.[key];
  return value != null ? String(value) : "";
}

/** Stesso valore numerico, separatore decimale italiano in UI. */
function pIt(params: Record<string, string | number> | undefined, key: string): string {
  return p(params, key).replace(".", ",");
}

const DISCIPLINARY_REASON_KEYS = new Set([
  "strict_referee_profile",
  "both_teams_high_foul_average",
  "high_foul_interaction",
  "high_foul_interaction_away",
  "physical_disciplinary_clash",
  "elevated_card_frequency",
  "elevated_match_intensity"
]);

export const MATCH_RADAR_REASON_TEXT: Record<
  "it" | "en",
  Record<string, (params?: Record<string, string | number>) => string>
> = {
  it: {
    high_foul_interaction: (params) =>
      `I dati indicano un profilo fisico elevato: ${p(params, "homeTeam")} commette molti falli (${p(params, "homeFoulsPct")}° percentile) e ${p(params, "awayTeam")} ne subisce spesso (${p(params, "awayDrawnPct")}°).`,
    high_foul_interaction_away: (params) =>
      `Il profilo statistico mostra ${p(params, "awayTeam")} con falli commessi frequenti, mentre ${p(params, "homeTeam")} subisce molti contatti (${p(params, "homeDrawnPct")}° percentile): la partita presenta un alto volume di interruzioni nei dati recenti.`,
    elevated_card_frequency: (params) =>
      `I dati recenti evidenziano cartellini sopra la media: ${p(params, "homeTeam")} ${pIt(params, "homeCardsAvg")}/partita e ${p(params, "awayTeam")} ${pIt(params, "awayCardsAvg")}/partita (indice ${p(params, "cardsPct")}/100). Potenziale disciplinare elevato.`,
    strict_referee_profile: (params) =>
      `Arbitro designato con profilo disciplinare elevato: ${pIt(params, "foulsPerMatch")} falli e ${pIt(params, "yellowPerMatch")} cartellini gialli di media a partita, rispettivamente pari al ${p(params, "foulsVsCompetitionPct")}% e al ${p(params, "yellowVsCompetitionPct")}% dei valori di riferimento della competizione. Analisi basata su ${p(params, "sample")} gare disponibili.`,
    both_teams_high_foul_average: (params) =>
      `Il profilo statistico mostra medie elevate di falli commessi: ${p(params, "homeTeam")} ${pIt(params, "homeFoulsAvg")} a partita e ${p(params, "awayTeam")} ${pIt(params, "awayFoulsAvg")} a partita. La partita presenta un contesto fisico marcato.`,
    physical_disciplinary_clash: (params) =>
      `I dati indicano un potenziale disciplinare elevato: ${p(params, "homeTeam")} e ${p(params, "awayTeam")} combinano medie alte di falli (${pIt(params, "homeFoulsAvg")} e ${pIt(params, "awayFoulsAvg")}) e cartellini (${pIt(params, "homeCardsAvg")} e ${pIt(params, "awayCardsAvg")}) nelle ultime gare.`,
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
      `${p(params, "homeTeam")} e ${p(params, "awayTeam")} presentano valori recenti molto simili: profilo statisticamente equilibrato.`,
    high_recent_variability: (params) =>
      `Le ultime prestazioni di ${p(params, "homeTeam")} e ${p(params, "awayTeam")} oscillano molto: alta variabilità statistica nel campione recente.`,
    corner_pressure_mismatch: (params) =>
      `I dati indicano un contrasto sulle fasce: ${p(params, "homeTeam")} genera molti corner, ${p(params, "awayTeam")} ne concede spesso.`,
    statistical_style_contrast: (params) =>
      `Il modello rileva un contrasto netto tra ciò che ${p(params, "homeTeam")} produce e ciò che ${p(params, "awayTeam")} concede (o viceversa).`,
    elevated_match_intensity: (params) =>
      `La partita ${p(params, "homeTeam")}–${p(params, "awayTeam")} presenta un'elevata intensità prevista sui dati di falli, cartellini e volume di gioco.`
  },
  en: {
    high_foul_interaction: (params) =>
      `The data indicate a physical profile: ${p(params, "homeTeam")} commits many fouls (${p(params, "homeFoulsPct")}th percentile) and ${p(params, "awayTeam")} often draws contact (${p(params, "awayDrawnPct")}th).`,
    high_foul_interaction_away: (params) =>
      `The statistical profile shows ${p(params, "awayTeam")} committing fouls frequently, while ${p(params, "homeTeam")} draws contact (${p(params, "homeDrawnPct")}th percentile): recent data show a high volume of stoppages.`,
    elevated_card_frequency: (params) =>
      `Recent data show cards above the average: ${p(params, "homeTeam")} ${p(params, "homeCardsAvg")}/match and ${p(params, "awayTeam")} ${p(params, "awayCardsAvg")}/match (index ${p(params, "cardsPct")}/100). Elevated disciplinary potential.`,
    strict_referee_profile: (params) =>
      `Appointed referee with an elevated disciplinary profile: ${p(params, "foulsPerMatch")} fouls and ${p(params, "yellowPerMatch")} yellow cards per match on average, respectively ${p(params, "foulsVsCompetitionPct")}% and ${p(params, "yellowVsCompetitionPct")}% of the competition reference values. Analysis based on ${p(params, "sample")} available matches.`,
    both_teams_high_foul_average: (params) =>
      `The statistical profile shows elevated foul averages: ${p(params, "homeTeam")} ${p(params, "homeFoulsAvg")} per match and ${p(params, "awayTeam")} ${p(params, "awayFoulsAvg")} per match.`,
    physical_disciplinary_clash: (params) =>
      `Physical-disciplinary clash: ${p(params, "homeTeam")} and ${p(params, "awayTeam")} combine high foul averages (${p(params, "homeFoulsAvg")} and ${p(params, "awayFoulsAvg")}) and card rates (${p(params, "homeCardsAvg")} and ${p(params, "awayCardsAvg")}) recently.`,
    elevated_offside_activity: (params) =>
      `Both teams play high lines: ${p(params, "homeTeam")} ${p(params, "homeOffsidesAvg")} offsides/match, ${p(params, "awayTeam")} ${p(params, "awayOffsidesAvg")} (index ${p(params, "offsidesPct")}/100).`,
    long_range_shooting_volume: (params) =>
      `High volume of shots from outside the box: ${p(params, "homeTeam")} ${p(params, "homeOutsideAvg")}/match and ${p(params, "awayTeam")} ${p(params, "awayOutsideAvg")}/match (index ${p(params, "outsidePct")}/100).`,
    home_long_range_threat: (params) =>
      `${p(params, "homeTeam")} shoots often from distance (${p(params, "homeOutsideAvg")} outside-box shots/match) against ${p(params, "awayTeam")} conceding long-range attempts (${p(params, "awayOutsideAvg")}/match).`,
    away_long_range_threat: (params) =>
      `${p(params, "awayTeam")} takes many shots from outside the box (${p(params, "awayOutsideAvg")}/match) against ${p(params, "homeTeam")} allowing long-range attempts (${p(params, "homeOutsideAvg")}/match).`,
    high_attacking_volume: (params) =>
      `${p(params, "homeTeam")} and ${p(params, "awayTeam")} produce an above-average shot volume (index ${p(params, "shotsPct")}/100).`,
    above_average_offensive_profile: (params) =>
      `The combined offensive profile of ${p(params, "homeTeam")} and ${p(params, "awayTeam")} is above the competition average.`,
    teams_statistically_close: (params) =>
      `${p(params, "homeTeam")} and ${p(params, "awayTeam")} have very similar recent metrics: a statistically balanced matchup.`,
    high_recent_variability: (params) =>
      `Recent performances by ${p(params, "homeTeam")} and ${p(params, "awayTeam")} swing widely: high statistical variability.`,
    corner_pressure_mismatch: (params) =>
      `The data indicate a wide contrast: ${p(params, "homeTeam")} creates many corners, ${p(params, "awayTeam")} frequently concedes them.`,
    statistical_style_contrast: (params) =>
      `The model detects a clear contrast between what ${p(params, "homeTeam")} produces and what ${p(params, "awayTeam")} allows.`,
    elevated_match_intensity: (params) =>
      `The ${p(params, "homeTeam")} vs ${p(params, "awayTeam")} fixture shows elevated statistical intensity on fouls, cards and playing volume.`
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
      `Profilo arbitrale con valori disciplinari elevati: +${boost} punti sul punteggio Match Radar (falli e cartellini sopra il riferimento della competizione).`,
    refereeVsCompetitionNote: (foulsPct: number, yellowPct: number) =>
      `I dati indicano valori pari al ${foulsPct}% dei falli e al ${yellowPct}% dei cartellini gialli rispetto ai riferimenti della competizione. Il profilo arbitrale è coerente con una gara ad alta intensità e con una maggiore frequenza di provvedimenti disciplinari.`,
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
      low: "Qualità dati: Bassa",
      medium: "Qualità dati: Media",
      high: "Qualità dati: Alta"
    },
    confidenceNote:
      "La qualità dati indica quantità, completezza e coerenza dei dati disponibili utilizzati per generare l'analisi statistica.",
    disciplinaryPotential: {
      low: "Potenziale disciplinare: Basso",
      medium: "Potenziale disciplinare: Medio",
      high: "Potenziale disciplinare: Alto"
    },
    highlightCombinedGoals: "Media gol combinati",
    legalDisclaimer:
      "PitchBrain fornisce analisi statistiche sportive a fini esclusivamente informativi. Non fornisce quote, consigli di scommessa, indicazioni di puntata o servizi relativi al gioco con vincite in denaro.",
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
      `Referee disciplinary values are elevated: +${boost} points on the Match Radar score (fouls and cards above the competition reference).`,
    refereeVsCompetitionNote: (foulsPct: number, yellowPct: number) =>
      `The data indicate values equal to ${foulsPct}% of fouls and ${yellowPct}% of yellow cards versus the competition reference. The referee profile is consistent with a high-intensity match and a higher frequency of disciplinary decisions.`,
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
      low: "Data quality: Low",
      medium: "Data quality: Medium",
      high: "Data quality: High"
    },
    confidenceNote:
      "Data quality reflects the volume, completeness and consistency of the data used to generate the statistical analysis.",
    disciplinaryPotential: {
      low: "Disciplinary potential: Low",
      medium: "Disciplinary potential: Medium",
      high: "Disciplinary potential: High"
    },
    highlightCombinedGoals: "Combined goals average",
    legalDisclaimer:
      "PitchBrain provides sports statistical analysis for informational purposes only. It does not provide odds, betting tips, wagering recommendations or services related to gambling for money.",
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

export function matchRadarDisciplinaryPotentialLabel(
  reasons: Array<{ key: string }>,
  locale: "it" | "en"
): string | null {
  const count = reasons.filter((reason) => DISCIPLINARY_REASON_KEYS.has(reason.key)).length;
  if (count <= 0) return null;
  const ui = MATCH_RADAR_UI_TEXT[locale].disciplinaryPotential;
  if (count >= 2) return ui.high;
  return ui.medium;
}

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
