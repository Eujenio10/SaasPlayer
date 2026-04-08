"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CompetitionScope,
  TacticalMetrics,
  TeamPerformanceBlueprint
} from "@/lib/types";

interface TeamOption {
  id: number;
  name: string;
}

interface DeepTeamPerformanceBlueprintProps {
  initialMetrics: TacticalMetrics[];
}

const SCOPES: CompetitionScope[] = ["DOMESTIC", "CUP", "EUROPE"];

const OFFENSIVE_LABELS: Array<[keyof TeamPerformanceBlueprint["offensive"], string]> = [
  ["goalsArea", "Tiri in Area"],
  ["goalsOutside", "Tiri Fuori Area"],
  ["goalsLeft", "Goal Piede Sinistro"],
  ["goalsRight", "Goal Piede Destro"],
  ["goalsHead", "Goal di Testa"],
  ["bigChancesCreated", "Grandi Occasioni Create"],
  ["bigChancesMissed", "Grandi Occasioni Mancate"],
  ["shotsOn", "Tiri in Porta"],
  ["shotsOff", "Tiri Fuori"],
  ["shotsBlocked", "Tiri Respinti"],
  ["dribbles", "Dribbling"],
  ["corners", "Corner"],
  ["freeKicksGoals", "Punizioni Goal"],
  ["freeKicksTotal", "Punizioni Totali"],
  ["penaltiesScored", "Rigori Segnati"],
  ["penaltiesTotal", "Rigori Totali"],
  ["counterattacks", "Contropiedi"],
  ["offsides", "Fuorigioco"],
  ["woodwork", "Pali/Traverse"]
];

const DEFENSIVE_LABELS: Array<[keyof TeamPerformanceBlueprint["defensive"], string]> = [
  ["cleanSheets", "Porta Inviolata"],
  ["goalsConceded", "Goal Subiti"],
  ["tackles", "Contrasti"],
  ["interceptions", "Intercetti"],
  ["clearances", "Rinvii"],
  ["recoveries", "Palle Recuperate"],
  ["errorsToShot", "Errori che portano al tiro"],
  ["errorsToGoal", "Errori che portano al goal"],
  ["penaltiesConceded", "Rigori Commessi"],
  ["goalLineClearances", "Salvataggi sulla Linea"],
  ["lastManFoul", "Fallo Ultimo Uomo"],
  ["foulsCommitted", "Falli Fatti"],
  ["yellowCards", "Cartellini Gialli"],
  ["redCards", "Cartellini Rossi"]
];

export function DeepTeamPerformanceBlueprint({
  initialMetrics
}: DeepTeamPerformanceBlueprintProps) {
  const initialTeams = useMemo<TeamOption[]>(() => {
    const map = new Map<number, string>();
    initialMetrics.forEach((item) => {
      if (item.teamId > 0 && !map.has(item.teamId)) {
        map.set(item.teamId, item.team);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [initialMetrics]);

  const [teams, setTeams] = useState<TeamOption[]>(initialTeams);
  const [teamSearch, setTeamSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [teamId, setTeamId] = useState<number>(initialTeams[0]?.id ?? 0);
  const [teamName, setTeamName] = useState<string>(initialTeams[0]?.name ?? "");
  const [scope, setScope] = useState<CompetitionScope>("DOMESTIC");
  const [blueprint, setBlueprint] = useState<TeamPerformanceBlueprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialTeams.length) return;
    setTeams((prev) => {
      const merged = new Map<number, string>();
      prev.forEach((team) => merged.set(team.id, team.name));
      initialTeams.forEach((team) => merged.set(team.id, team.name));
      return Array.from(merged.entries()).map(([id, name]) => ({ id, name }));
    });
  }, [initialTeams]);

  useEffect(() => {
    if (!teams.length) return;
    if (!teams.some((item) => item.id === teamId)) {
      setTeamId(teams[0].id);
      setTeamName(teams[0].name);
    }
  }, [teams, teamId]);

  useEffect(() => {
    if (teamId <= 0 || !teamName) {
      setBlueprint(null);
      return;
    }

    let cancelled = false;

    async function loadBlueprint() {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/tactical/team-performance?teamId=${teamId}&teamName=${encodeURIComponent(
          teamName
        )}&scope=${scope}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        if (!cancelled) {
          setError("Impossibile caricare il blueprint squadra.");
          setLoading(false);
        }
        return;
      }

      const json = (await response.json()) as { blueprint?: TeamPerformanceBlueprint };
      if (!cancelled) {
        setBlueprint(json.blueprint ?? null);
        setLoading(false);
      }
    }

    void loadBlueprint();

    return () => {
      cancelled = true;
    };
  }, [teamId, teamName, scope]);

  async function handleTeamSearch() {
    const query = teamSearch.trim();
    if (query.length < 2) {
      setError("Inserisci almeno 2 caratteri per cercare la squadra.");
      return;
    }

    setSearchLoading(true);
    setError(null);

    const response = await fetch(
      `/api/tactical/team-search?q=${encodeURIComponent(query)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      setSearchLoading(false);
      setError("Ricerca squadra non disponibile al momento.");
      return;
    }

    const json = (await response.json()) as { teams?: TeamOption[] };
    const found = json.teams ?? [];
    if (!found.length) {
      setSearchLoading(false);
      setError("Nessuna squadra trovata nel perimetro Top5 + UCL/UEL.");
      return;
    }

    setTeams((prev) => {
      const merged = new Map<number, string>();
      prev.forEach((team) => merged.set(team.id, team.name));
      found.forEach((team) => merged.set(team.id, team.name));
      return Array.from(merged.entries()).map(([id, name]) => ({ id, name }));
    });

    setTeamId(found[0].id);
    setTeamName(found[0].name);
    setSearchLoading(false);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-cyan-400/30 bg-slate-900/50 p-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-cyan-300">
          Deep Team Performance Blueprint
        </h2>
        <p className="text-sm text-slate-300">
          Analisi profonda multi-contesto con switch tra campionato, coppe nazionali e coppe
          europee.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Squadra</span>
          <div className="mb-2 flex gap-2">
            <input
              className="w-full rounded-xl border border-cyan-400/40 bg-darkGray p-3 text-slate-100"
              placeholder="Cerca squadra (es. Inter, Arsenal, Dortmund)"
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void handleTeamSearch()}
              className="rounded-xl border border-cyan-300/40 px-4 text-xs font-semibold tracking-wide text-cyan-200"
              disabled={searchLoading}
            >
              {searchLoading ? "..." : "Cerca"}
            </button>
          </div>
          <select
            className="w-full rounded-xl border border-cyan-400/40 bg-darkGray p-3 text-slate-100"
            value={`${teamId}:${teamName}`}
            onChange={(event) => {
              const [idRaw, ...nameParts] = event.target.value.split(":");
              setTeamId(Number(idRaw));
              setTeamName(nameParts.join(":"));
            }}
          >
            {teams.map((team) => (
              <option key={team.id} value={`${team.id}:${team.name}`}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Contesto</span>
          <div className="grid grid-cols-3 gap-2">
            {SCOPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide ${
                  scope === item
                    ? "border-cyan-300 bg-cyan-400/20 text-cyan-200"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400/50"
                }`}
              >
                [{item}]
              </button>
            ))}
          </div>
        </div>
      </div>

      {teams.length === 0 ? (
        <p className="rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm text-amber-100">
          Nessuna squadra disponibile. Usa la ricerca per selezionare un club Top5/UCL/UEL.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">Caricamento blueprint in corso...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {blueprint ? (
        <div className="space-y-5">
          <p className="text-xs text-slate-400">
            Competizioni incluse: {blueprint.competitions.join(", ")}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-200">
                Offensive
              </h3>
              <div className="space-y-1 text-sm">
                {OFFENSIVE_LABELS.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between border-b border-slate-800 py-1">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-semibold text-cyan-100">{blueprint.offensive[key]}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-violet-400/20 bg-slate-950/70 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-violet-200">
                Defensive
              </h3>
              <div className="space-y-1 text-sm">
                {DEFENSIVE_LABELS.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between border-b border-slate-800 py-1">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-semibold text-violet-100">{blueprint.defensive[key]}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
