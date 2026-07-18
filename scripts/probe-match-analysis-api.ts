import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
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
}

loadEnvLocal();

async function probe(url: string) {
  console.log("\nGET", url);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    console.log("status", res.status, "ms", Date.now() - started);
    const body = await res.json();
    if (body.error) console.log("error", body.error);
    if (Array.isArray(body.matches)) console.log("matches", body.total ?? body.matches.length);
    if (Array.isArray(body.metrics)) {
      console.log("metrics", body.metrics.length, "teamForm", body.teamFormSignals != null);
    }
  } catch (error) {
    console.error("failed", Date.now() - started, error instanceof Error ? error.message : error);
  }
}

async function main() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await probe(`${base}/api/tactical/matches`);
  await probe(`${base}/api/tactical/org-kiosk-match-insights?eventId=12813006`);
}

main();
