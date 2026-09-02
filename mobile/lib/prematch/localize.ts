import type { PreMatchKeyStat } from "@/lib/prematch-report/types";
import {
  getActiveLocale,
  t,
  translatePrematchBadge,
  translatePrematchKeyFactor,
  translatePrematchStatLabel,
  type AppLocale
} from "@/lib/i18n";

function replaceKnownItalian(text: string, locale: AppLocale): string {
  if (locale === "it" || !text) return text;
  let out = text;

  const fragments: Array<[string, string]> = [
    [
      "Entrambe le squadre mantengono un andamento coerente con le proprie medie stagionali.",
      t("prematch.formBothStable", undefined, locale)
    ],
    [
      "Le due squadre mostrano volumi offensivi comparabili, con differenze più evidenti nel modo di arrivare in zona pericolosa. ",
      "The two teams show comparable attacking volumes, with clearer differences in how they reach dangerous areas. "
    ],
    [
      "Le due squadre mostrano volumi offensivi comparabili, con differenze più evidenti nel modo di arrivare in zona pericolosa.",
      "The two teams show comparable attacking volumes, with clearer differences in how they reach dangerous areas."
    ],
    [
      "Il cuore del campo può orientare la gara: la squadra più efficace tra le linee può impostare il ritmo e alimentare le zone finali.",
      "The centre of the pitch can shape the game: the more effective team between the lines can set the tempo and feed the final third."
    ],
    [
      "L'area di rigore è il punto nevralgico: la squadra che entra più spesso in zona alta può sfruttare la minore solidità difensiva avversaria.",
      "The penalty area is the key point: the team that enters the box more often can exploit weaker defensive solidity."
    ],
    [
      "Le transizioni rapide possono fare la differenza: chi recupera palla in campo alto e attacca spazio può punire una difesa non ancora organizzata.",
      "Quick transitions can make the difference: winning the ball high and attacking space can punish a defence that is not yet set."
    ],
    [
      "Le palle inattive possono pesare sul match: corner e calci piazzati offrono occasioni concrete in una gara che potrebbe decidersi su episodi.",
      "Set pieces can weigh on the match: corners and dead balls offer concrete chances in a game that may be decided by episodes."
    ],
    [
      "Il controllo del gioco appare equilibrato: entrambe le squadre hanno strumenti per alternare fasi di gestione e momenti di apertura del match.",
      "Game control looks balanced: both teams can alternate management phases and moments that open the match."
    ],
    [
      "Il peso delle palle inattive resta contenuto rispetto ad altri fattori di gioco, pur potendo incidere su episoli chiave.",
      "The weight of set pieces remains limited compared with other factors, though they can still decide key episodes."
    ],
    [
      "Analisi basata sui dati disponibili per una o entrambe le squadre.",
      "Analysis based on the data available for one or both teams."
    ],
    [
      "I profili difensivi vanno letti sul volume di occasioni concesse e sulla qualità delle zone lasciate libere.",
      t("prematch.defFallback", undefined, locale)
    ]
  ];

  for (const [it, en] of fragments) {
    out = out.split(it).join(en);
  }

  const patterns: Array<[RegExp, (...args: string[]) => string]> = [
    [
      /^La partita si presenta come (.+), con ritmo (.+) e maggiore controllo atteso da (.+)\. Il fattore più rilevante riguarda (.+), con attenzione particolare a (.+)\.$/,
      (_m, type, tempo, control, factor, zone) =>
        `The match looks like a ${translatePrematchBadge(capitalizeFirst(type), locale).toLowerCase()}, with ${translatePrematchBadge(capitalizeFirst(tempo), locale).toLowerCase()} tempo and greater expected control from ${translatePrematchBadge(control, locale)}. The main factor is ${translatePrematchKeyFactor(capitalizeFirst(factor), locale).toLowerCase()}, with particular attention to ${translatePrematchBadge(capitalizeFirst(zone), locale).toLowerCase()}.`
    ],
    [
      /(.+) e (.+) arrivano al match con profili di forma recente distinti\. /,
      (_m, a, b) => `${a} and ${b} arrive with distinct recent-form profiles. `
    ],
    [
      /(.+) mostra segnali di sovra-rendimento recente: volume offensivo in crescita rispetto alla media stagionale\. /,
      (_m, team) =>
        `${team} shows signs of recent overperformance: attacking volume is rising versus the seasonal average. `
    ],
    [
      /(.+) produce meno tiri del solito nelle ultime uscite, nonostante eventuali risultati apparenti\. /,
      (_m, team) => `${team} is producing fewer shots than usual in recent matches, despite any apparent results. `
    ],
    [
      /(.+) ha aumentato la produzione offensiva nelle partite più recenti\. /,
      (_m, team) => `${team} has increased attacking output in the most recent matches. `
    ],
    [
      /(.+) registra un calo di continuità offensiva rispetto al trend stagionale\. /,
      (_m, team) => `${team} shows a drop in attacking continuity versus the seasonal trend. `
    ],
    [
      /(.+) presenta un profilo offensivo più continuo, con maggiore volume e qualità nelle occasioni create\. /,
      (_m, team) =>
        `${team} has a more consistent attacking profile, with greater volume and quality in chances created. `
    ],
    [
      /(.+) entra più spesso in area rispetto all'avversaria\. /,
      (_m, team) => `${team} gets into the box more often than the opponent. `
    ],
    [
      /(.+) lavora con maggiore frequenza dentro l'area di rigore\. /,
      (_m, team) => `${team} works more often inside the penalty area. `
    ],
    [
      /(.+) distribuisce meglio il gioco sulle fasce\./,
      (_m, team) => `${team} spreads play better out wide.`
    ],
    [
      /(.+) tende a sviluppare più azioni sulle corsie esterne\./,
      (_m, team) => `${team} tends to develop more actions down the wide channels.`
    ],
    [
      /La fascia laterale di (.+) può essere decisiva: da quel lato la squadra concentra buona parte delle azioni offensive, mentre (.+) mostra maggiore permeabilità sul corridoio opposto\./,
      (_m, home, away) =>
        `${home}'s wide flank can be decisive: that side concentrates a large share of attacking actions, while ${away} looks more open on the opposite corridor.`
    ],
    [
      /(.+) dovrebbe guidare il possesso e il controllo territoriale, mentre (.+) può rendersi pericolosa quando trova spazio in ripartenza\./,
      (_m, a, b) =>
        `${a} should lead possession and territorial control, while ${b} can become dangerous when space opens on the break.`
    ],
    [
      /(.+) può impostare il gioco con continuità, ma (.+) resta in partita sfruttando momenti di verticalità\./,
      (_m, a, b) =>
        `${a} can set the game with continuity, but ${b} stays in the contest by using moments of verticality.`
    ],
    [
      /Le palle inattive possono avere peso (.+)\. (.+) produce (.+) corner a partita; (.+) ne guadagna (.+)\./,
      (_m, weight, home, homeCorners, away, awayCorners) =>
        `Set pieces can carry ${translatePrematchBadge(capitalizeFirst(weight.replace("_", "-")), locale).toLowerCase()} weight. ${home} wins ${homeCorners} corners per match; ${away} wins ${awayCorners}.`
    ],
    [
      /(.+) subisce pochi gol in media e mantiene una difesa strutturata\. /,
      (_m, team) => `${t("prematch.defFewGoals", { team }, locale)} `
    ],
    [
      /(.+) concede un volume di occasioni superiore alla media difensiva ideale\. /,
      (_m, team) => `${t("prematch.defConcedesChances", { team }, locale)} `
    ],
    [
      /(.+) limita bene le reti subite, anche quando non domina il possesso\. /,
      (_m, team) => `${t("prematch.defLimitsGoals", { team }, locale)} `
    ],
    [
      /(.+) può concedere spazio in zona pericolosa pur limitando il numero complessivo di tiri\. /,
      (_m, team) => `${t("prematch.defGivesSpace", { team }, locale)} `
    ]
  ];

  for (const [re, replacer] of patterns) {
    out = out.replace(re, (...args) => replacer(...(args as string[])));
  }
  return out;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function localizePrematchText(text: string, locale: AppLocale = getActiveLocale()): string {
  return replaceKnownItalian(text, locale);
}

export function localizePrematchKeyStats(
  stats: PreMatchKeyStat[] | undefined,
  locale: AppLocale = getActiveLocale()
): PreMatchKeyStat[] {
  if (!stats?.length) return [];
  return stats.map((stat) => ({
    ...stat,
    label: translatePrematchStatLabel(stat.label, locale)
  }));
}

export function prematchSectionMeta(id: string, locale: AppLocale = getActiveLocale()) {
  const map: Record<string, { title: string; short: string; desc: string }> = {
    summary: {
      title: t("prematch.navSummary", undefined, locale),
      short: t("prematch.summaryShort", undefined, locale),
      desc: t("prematch.navSummaryDesc", undefined, locale)
    },
    realForm: {
      title: t("prematch.navForm", undefined, locale),
      short: t("prematch.formShort", undefined, locale),
      desc: t("prematch.navFormDesc", undefined, locale)
    },
    offensive: {
      title: t("prematch.navOffensive", undefined, locale),
      short: t("prematch.offensiveShort", undefined, locale),
      desc: t("prematch.navOffensiveDesc", undefined, locale)
    },
    defensive: {
      title: t("prematch.navDefensive", undefined, locale),
      short: t("prematch.defensiveShort", undefined, locale),
      desc: t("prematch.navDefensiveDesc", undefined, locale)
    },
    keyZone: {
      title: t("prematch.navKeyZone", undefined, locale),
      short: t("prematch.keyZoneShort", undefined, locale),
      desc: t("prematch.navKeyZoneDesc", undefined, locale)
    },
    tempo: {
      title: t("prematch.navTempo", undefined, locale),
      short: t("prematch.tempoShort", undefined, locale),
      desc: t("prematch.navTempoDesc", undefined, locale)
    },
    setPieces: {
      title: t("prematch.navSetPieces", undefined, locale),
      short: t("prematch.setPiecesShort", undefined, locale),
      desc: t("prematch.navSetPiecesDesc", undefined, locale)
    }
  };
  return map[id] ?? { title: id, short: id, desc: "" };
}

export function localizeSetPieceWeight(
  weight: "basso" | "medio" | "medio_alto" | "alto",
  locale: AppLocale = getActiveLocale()
): string {
  const map = {
    basso: t("prematch.weightLow", undefined, locale),
    medio: t("prematch.weightMedium", undefined, locale),
    medio_alto: t("prematch.weightMediumHigh", undefined, locale),
    alto: t("prematch.weightHigh", undefined, locale)
  } as const;
  return map[weight];
}
