import assert from "node:assert/strict";
import {
  normalizeFantaTeamKey,
  resolveFantacalcioQuotation
} from "@/lib/fanta/quotazioni";

assert.equal(normalizeFantaTeamKey("FC Internazionale"), "INTER");
assert.equal(normalizeFantaTeamKey("Inter"), "INTER");
assert.equal(normalizeFantaTeamKey("AC Milan"), "MILAN");
assert.equal(normalizeFantaTeamKey("Atalanta BC"), "ATALANTA");
assert.equal(normalizeFantaTeamKey("AS Roma"), "ROMA");
assert.equal(normalizeFantaTeamKey("SS Lazio"), "LAZIO");
assert.equal(normalizeFantaTeamKey("SSC Napoli"), "NAPOLI");
assert.equal(normalizeFantaTeamKey("Genoa CFC"), "GENOA");
assert.equal(normalizeFantaTeamKey("Como 1907"), "COMO");
assert.equal(normalizeFantaTeamKey("Parma Calcio 1913"), "PARMA");
assert.equal(normalizeFantaTeamKey("Venezia FC"), "VENEZIA");
assert.equal(normalizeFantaTeamKey("Torino FC"), "TORINO");
assert.equal(normalizeFantaTeamKey("AC Monza"), "MONZA");
assert.equal(normalizeFantaTeamKey("Frosinone Calcio"), "FROSINONE");

const lautaro = resolveFantacalcioQuotation("Lautaro Martinez", "Inter");
assert.equal(lautaro?.role, "A");
assert.equal(lautaro?.mantra, "Pc");
assert.equal(lautaro?.roleGroup, "forward");

const carnesecchi = resolveFantacalcioQuotation("Marco Carnesecchi", "Atalanta BC");
assert.equal(carnesecchi?.role, "P");
assert.equal(carnesecchi?.team, "Atalanta");

const svilarLong = resolveFantacalcioQuotation("Mile Svilar", "AS Roma");
assert.equal(svilarLong?.role, "P");
assert.equal(svilarLong?.team, "Roma");

const josep = resolveFantacalcioQuotation("Josep Martinez", "FC Internazionale");
assert.equal(josep?.role, "P");
assert.equal(josep?.name, "Martinez Jo.");

const svilar = resolveFantacalcioQuotation("Mile Svilar", "AS Roma");
assert.equal(svilar?.role, "P");
assert.equal(svilar?.name, "Svilar");

const politano = resolveFantacalcioQuotation("Matteo Politano", "SSC Napoli");
assert.equal(politano?.role, "C");
assert.equal(politano?.mantra, "W");

const dimarco = resolveFantacalcioQuotation("Federico Dimarco", "Inter");
assert.equal(dimarco?.role, "D");

console.log("fanta quotazioni tests passed");
