import { readFileSync } from "fs";
import { resolve } from "path";
import { rebuildMarkingsSnapshotFromStoredInsights } from "../lib/difficult-markings/snapshot";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const org = process.env.PITCHBRAIN_PUBLIC_ORG_ID?.trim() ?? "11111111-1111-1111-1111-111111111111";

rebuildMarkingsSnapshotFromStoredInsights(org)
  .then((result) => {
    console.log("ok:", result.ok);
    console.log("message:", result.message ?? "(none)");
    console.log("matchups:", Object.keys(result.snapshot?.matchupIndex ?? {}).length);
    console.log("rounds:", result.snapshot?.rounds?.length ?? 0);
    const now = Math.floor(Date.now() / 1000);
    for (const item of Object.values(result.snapshot?.matchupIndex ?? {})) {
      console.log(
        " sample:",
        item.homeTeamName,
        "vs",
        item.awayTeamName,
        "score",
        item.difficultMarkingScore,
        "kickoff",
        item.kickoffTimestamp,
        new Date(item.kickoffTimestamp * 1000).toISOString(),
        item.kickoffTimestamp > now ? "FUTURE" : "PAST"
      );
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
