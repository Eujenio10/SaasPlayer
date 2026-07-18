import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const envText = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const key = envText.match(/^SPORTAPI_RAPIDAPI_KEY=(.+)$/m)?.[1]?.trim();
const host = envText.match(/^SPORTAPI_RAPIDAPI_HOST=(.+)$/m)?.[1]?.trim();
if (!key || !host) {
  console.error("Missing SPORTAPI_RAPIDAPI_KEY or HOST in .env.local");
  process.exit(1);
}

const endpoints = [
  ["match-event-all-stats", `https://${host}/football-get-match-event-all-stats?eventid=4621624`],
  ["match-detail", `https://${host}/football-get-match-detail?eventid=4621624`],
  ["player-detail-671529", `https://${host}/football-get-player-detail?playerid=671529`],
  ["player-detail-207069", `https://${host}/football-get-player-detail?playerid=207069`],
  ["list-player-10235", `https://${host}/football-get-list-player?teamid=10235`],
  ["h2h", `https://${host}/football-get-head-to-head?eventid=4621624`],
  ["top-players-rating-42", `https://${host}/football-get-top-players-by-rating?leagueid=42`],
  ["top-players-goals-42", `https://${host}/football-get-top-players-by-goals?leagueid=42`],
  ["statistics-event", `https://${host}/football-get-statistics-event?eventid=4621624`],
  ["get-statistics-event", `https://${host}/football-get-statistics-event-by-event-id?eventid=4621624`],
  ["match-event-stats", `https://${host}/football-get-match-event-stats?eventid=4621624`]
];

const outDir = path.join(root, "scripts", "api-probe-output");
fs.mkdirSync(outDir, { recursive: true });

for (const [name, url] of endpoints) {
  const res = await fetch(url, {
    headers: { "x-rapidapi-host": host, "x-rapidapi-key": key }
  });
  const text = await res.text();
  fs.writeFileSync(path.join(outDir, `${name}.json`), text);
  console.log(name, res.status, text.length);
}
