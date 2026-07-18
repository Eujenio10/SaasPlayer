type LocalizableMatch = {
  competitionName?: string;
  competitionSlug?: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
};

export type LocalizableTacticalMetric = {
  playerName: string;
  team: string;
  sparkFrictionHeatmap?: { labelA: string; labelB: string } | null;
  sparkDuel?: { playerA: string; playerB: string } | null;
};

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TEAM_NAME_IT: Record<string, string> = {
  england: "Inghilterra",
  "dr congo": "RD del Congo",
  "democratic republic of the congo": "RD del Congo",
  "congo dr": "RD del Congo",
  "congo democratic republic": "RD del Congo",
  "cape verde": "Capo Verde",
  "cabo verde": "Capo Verde",
  argentina: "Argentina",
  brazil: "Brasile",
  germany: "Germania",
  spain: "Spagna",
  france: "Francia",
  italy: "Italia",
  netherlands: "Paesi Bassi",
  "the netherlands": "Paesi Bassi",
  holland: "Paesi Bassi",
  belgium: "Belgio",
  portugal: "Portogallo",
  croatia: "Croazia",
  switzerland: "Svizzera",
  austria: "Austria",
  poland: "Polonia",
  denmark: "Danimarca",
  sweden: "Svezia",
  norway: "Norvegia",
  scotland: "Scozia",
  wales: "Galles",
  ireland: "Irlanda",
  "republic of ireland": "Irlanda",
  "northern ireland": "Irlanda del Nord",
  "czech republic": "Rep. Ceca",
  czechia: "Rep. Ceca",
  serbia: "Serbia",
  ukraine: "Ucraina",
  turkey: "Turchia",
  greece: "Grecia",
  romania: "Romania",
  hungary: "Ungheria",
  slovakia: "Slovacchia",
  slovenia: "Slovenia",
  albania: "Albania",
  "ivory coast": "Costa d'Avorio",
  "cote d ivoire": "Costa d'Avorio",
  ghana: "Ghana",
  cameroon: "Camerun",
  nigeria: "Nigeria",
  tunisia: "Tunisia",
  algeria: "Algeria",
  egypt: "Egitto",
  morocco: "Marocco",
  senegal: "Senegal",
  "south africa": "Sudafrica",
  uruguay: "Uruguay",
  chile: "Cile",
  colombia: "Colombia",
  ecuador: "Ecuador",
  peru: "Perù",
  paraguay: "Paraguay",
  venezuela: "Venezuela",
  bolivia: "Bolivia",
  mexico: "Messico",
  "costa rica": "Costa Rica",
  panama: "Panama",
  honduras: "Honduras",
  jamaica: "Giamaica",
  canada: "Canada",
  usa: "Stati Uniti",
  "united states": "Stati Uniti",
  "south korea": "Corea del Sud",
  "korea republic": "Corea del Sud",
  japan: "Giappone",
  australia: "Australia",
  "new zealand": "Nuova Zelanda",
  "saudi arabia": "Arabia Saudita",
  iran: "Iran",
  qatar: "Qatar",
  uae: "Emirati Arabi Uniti",
  "united arab emirates": "Emirati Arabi Uniti",
  iraq: "Iraq",
  china: "Cina",
  india: "India",
  indonesia: "Indonesia",
  thailand: "Thailandia",
  vietnam: "Vietnam",
  uzbekistan: "Uzbekistan",
  georgia: "Georgia",
  "north macedonia": "Macedonia del Nord",
  montenegro: "Montenegro",
  "bosnia and herzegovina": "Bosnia-Erzegovina",
  israel: "Israele",
  finland: "Finlandia",
  iceland: "Islanda",
  "bayern munich": "Bayern Monaco",
  "bayern munchen": "Bayern Monaco",
  "atletico madrid": "Atletico Madrid",
  "athletic bilbao": "Athletic Bilbao",
  "athletic club": "Athletic Bilbao",
  "real betis": "Real Betis",
  "borussia monchengladbach": "Borussia M'gladbach",
  "borussia m gladbach": "Borussia M'gladbach",
  "manchester united": "Manchester United",
  "manchester city": "Manchester City",
  "newcastle united": "Newcastle United",
  "west ham united": "West Ham United",
  "nottingham forest": "Nottingham Forest",
  "crystal palace": "Crystal Palace",
  "aston villa": "Aston Villa",
  "tottenham hotspur": "Tottenham",
  internazionale: "Inter",
  "inter milan": "Inter",
  "ac milan": "Milan",
  juventus: "Juventus",
  napoli: "Napoli",
  roma: "Roma",
  lazio: "Lazio",
  fiorentina: "Fiorentina",
  atalanta: "Atalanta",
  torino: "Torino",
  bologna: "Bologna",
  udinese: "Udinese",
  genoa: "Genoa",
  sassuolo: "Sassuolo",
  lecce: "Lecce",
  verona: "Verona",
  empoli: "Empoli",
  cagliari: "Cagliari",
  monza: "Monza",
  parma: "Parma",
  como: "Como",
  venezia: "Venezia",
  liverpool: "Liverpool",
  chelsea: "Chelsea",
  arsenal: "Arsenal",
  tottenham: "Tottenham",
  everton: "Everton",
  fulham: "Fulham",
  brentford: "Brentford",
  wolves: "Wolverhampton",
  wolverhampton: "Wolverhampton",
  "wolverhampton wanderers": "Wolverhampton",
  "west ham": "West Ham",
  brighton: "Brighton",
  "brighton hove albion": "Brighton",
  bournemouth: "Bournemouth",
  leicester: "Leicester",
  ipswich: "Ipswich",
  southampton: "Southampton",
  "real madrid": "Real Madrid",
  barcelona: "Barcellona",
  "fc barcelona": "Barcellona",
  sevilla: "Siviglia",
  valencia: "Valencia",
  villarreal: "Villarreal",
  "real sociedad": "Real Sociedad",
  getafe: "Getafe",
  girona: "Girona",
  osasuna: "Osasuna",
  "borussia dortmund": "Borussia Dortmund",
  "rb leipzig": "RB Lipsia",
  "bayer leverkusen": "Bayer Leverkusen",
  "eintracht frankfurt": "Eintracht Frankfurt",
  wolfsburg: "Wolfsburg",
  freiburg: "Freiburg",
  stuttgart: "Stoccarda",
  "paris saint germain": "Paris Saint-Germain",
  psg: "Paris Saint-Germain",
  marseille: "Marsiglia",
  lyon: "Lione",
  monaco: "Monaco",
  lille: "Lilla",
  nice: "Nizza",
  lens: "Lens",
  rennes: "Rennes",
  angers: "Angers",
  strasbourg: "Strasburgo",
  toulouse: "Tolosa",
  nantes: "Nantes",
  reims: "Reims",
  brest: "Brest",
  montpellier: "Montpellier",
  "le havre": "Le Havre",
  auxerre: "Auxerre",
  "saint etienne": "Saint-Étienne"
};

const COMPETITION_SLUG_IT: Record<string, string> = {
  "world-championship": "Coppa del Mondo",
  "world-cup": "Coppa del Mondo",
  "uefa-nations-league": "UEFA Nations League",
  "nations-league": "UEFA Nations League",
  "uefa-champions-league": "Champions League",
  "uefa-europa-league": "Europa League",
  "uefa-europa-conference-league": "Conference League",
  "serie-a": "Serie A",
  "premier-league": "Premier League",
  laliga: "La Liga",
  "la-liga": "La Liga",
  bundesliga: "Bundesliga",
  "ligue-1": "Ligue 1"
};

const COMPETITION_NAME_IT: Record<string, string> = {
  "fifa world cup": "Coppa del Mondo",
  "world cup": "Coppa del Mondo",
  "world cup 2026": "Coppa del Mondo 2026",
  "world championship": "Coppa del Mondo",
  "uefa nations league": "UEFA Nations League",
  "nations league": "UEFA Nations League",
  "uefa champions league": "Champions League",
  "champions league": "Champions League",
  "uefa europa league": "Europa League",
  "europa league": "Europa League",
  "uefa conference league": "Conference League",
  "conference league": "Conference League",
  "premier league": "Premier League",
  "serie a": "Serie A",
  "la liga": "La Liga",
  laliga: "La Liga",
  bundesliga: "Bundesliga",
  "ligue 1": "Ligue 1",
  "coppa italia": "Coppa Italia",
  "fa cup": "FA Cup",
  "copa del rey": "Copa del Rey",
  "dfb pokal": "DFB-Pokal",
  "coupe de france": "Coupe de France"
};

export function translateTeamName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return trimmed;
  const key = normalizeLookupKey(trimmed);
  return TEAM_NAME_IT[key] ?? trimmed;
}

export function translateCompetitionName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return trimmed;
  const slugKey = trimmed.toLowerCase().replace(/\s+/g, "-");
  if (COMPETITION_SLUG_IT[slugKey]) return COMPETITION_SLUG_IT[slugKey]!;
  const key = normalizeLookupKey(trimmed);
  return COMPETITION_NAME_IT[key] ?? trimmed;
}

export function translateCompetitionSlug(slug: string, fallbackName?: string): string {
  const key = (slug ?? "").trim().toLowerCase();
  if (key && COMPETITION_SLUG_IT[key]) return COMPETITION_SLUG_IT[key]!;
  if (fallbackName?.trim()) return translateCompetitionName(fallbackName);
  return slug;
}

const POSITION_ROLE_IT: Record<string, string> = {
  g: "Portiere",
  gk: "Portiere",
  d: "Difensore",
  dc: "Difensore",
  cb: "Difensore",
  m: "Centrocampista",
  mf: "Centrocampista",
  f: "Attaccante",
  fw: "Attaccante",
  st: "Attaccante",
  goalkeeper: "Portiere",
  defender: "Difensore",
  midfielder: "Centrocampista",
  forward: "Attaccante",
  attacker: "Attaccante"
};

export function translatePositionRole(codeOrLabel: string): string {
  const trimmed = (codeOrLabel ?? "").trim();
  if (!trimmed) return trimmed;
  const key = normalizeLookupKey(trimmed);
  return POSITION_ROLE_IT[key] ?? trimmed;
}

export function roleLabelSingular(groupLabel: string): string {
  const map: Record<string, string> = {
    Portiere: "Portiere",
    Difensori: "Difensore",
    Attaccanti: "Attaccante",
    Centrocampo: "Centrocampista"
  };
  return map[groupLabel] ?? groupLabel;
}

/** I nomi propri dei giocatori restano invariati; normalizziamo solo spazi e maiuscole iniziali. */
export function formatPlayerDisplayName(name: string): string {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return trimmed
    .split(" ")
    .map((part) => {
      if (part.length <= 2 && part === part.toUpperCase()) return part;
      if (part.includes("-")) {
        return part
          .split("-")
          .map((seg) => (seg ? seg[0]!.toUpperCase() + seg.slice(1).toLowerCase() : seg))
          .join("-");
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function localizeUpcomingMatch<T extends LocalizableMatch>(match: T): T {
  const competitionName = translateCompetitionSlug(
    match.competitionSlug ?? "",
    match.competitionName
  );
  return {
    ...match,
    competitionName,
    homeTeam: {
      ...match.homeTeam,
      name: translateTeamName(match.homeTeam.name)
    },
    awayTeam: {
      ...match.awayTeam,
      name: translateTeamName(match.awayTeam.name)
    }
  };
}

export function localizeUpcomingMatches<T extends LocalizableMatch>(matches: T[]): T[] {
  return matches.map(localizeUpcomingMatch);
}

export function replaceTeamNamesInText(
  text: string,
  rawHome: string,
  home: string,
  rawAway: string,
  away: string
): string {
  let out = text;
  if (rawHome && rawHome !== home) out = out.split(rawHome).join(home);
  if (rawAway && rawAway !== away) out = out.split(rawAway).join(away);
  return out;
}

export function localizeNamedTeam(
  value: string,
  rawHome: string,
  home: string,
  rawAway: string,
  away: string
): string {
  if (value === rawHome) return home;
  if (value === rawAway) return away;
  if (value === "Equilibrio") return value;
  return translateTeamName(value);
}

export function localizeTacticalMetric<T extends LocalizableTacticalMetric>(metric: T): T {
  const localized: T = {
    ...metric,
    playerName: formatPlayerDisplayName(metric.playerName),
    team: translateTeamName(metric.team)
  };

  if (localized.sparkFrictionHeatmap) {
    localized.sparkFrictionHeatmap = {
      ...localized.sparkFrictionHeatmap,
      labelA: formatPlayerDisplayName(localized.sparkFrictionHeatmap.labelA),
      labelB: formatPlayerDisplayName(localized.sparkFrictionHeatmap.labelB)
    };
  }

  if (localized.sparkDuel) {
    localized.sparkDuel = {
      ...localized.sparkDuel,
      playerA: formatPlayerDisplayName(localized.sparkDuel.playerA),
      playerB: formatPlayerDisplayName(localized.sparkDuel.playerB)
    };
  }

  return localized;
}

export function localizeTacticalMetrics<T extends LocalizableTacticalMetric>(metrics: T[]): T[] {
  return metrics.map(localizeTacticalMetric);
}
