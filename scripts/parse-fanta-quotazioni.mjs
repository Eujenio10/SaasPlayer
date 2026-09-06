import fs from "fs";
import path from "path";

const dir = path.join(process.env.TEMP, "fanta-quotes-xlsx", "xl");
const sst = fs.readFileSync(path.join(dir, "sharedStrings.xml"), "utf8");
const strings = [...sst.matchAll(/<t(?: xml:space="preserve")?>([^<]*)<\/t>/g)].map((m) => m[1]);
const sheet = fs.readFileSync(path.join(dir, "worksheets", "sheet1.xml"), "utf8");

function colRow(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  const col = m[1].split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  return { col, row: Number(m[2]) };
}

const cells = [...sheet.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?/g)];
const grid = new Map();
for (const c of cells) {
  const { col, row } = colRow(c[1]);
  const attrs = c[2];
  const v = c[3];
  let val = null;
  if (attrs.includes('t="s"')) val = strings[Number(v)];
  else if (v != null) val = v;
  if (!grid.has(row)) grid.set(row, {});
  grid.get(row)[col] = val;
}

const rows = [...grid.keys()].sort((a, b) => a - b);
const players = [];
for (const r of rows) {
  const row = grid.get(r);
  const id = String(row[1] ?? "").trim();
  const role = String(row[2] ?? "").trim();
  const mantra = String(row[3] ?? "").trim();
  const name = String(row[4] ?? "").trim();
  const team = String(row[5] ?? "").trim();
  if (!id || id === "Id" || role === "R" || !name || !role) continue;
  if (!/^[PDCA]$/.test(role)) continue;
  players.push({ id, role, mantra, name, team });
}

const out = path.join(process.cwd(), "lib", "fanta", "quotazioni-2026-27.json");
fs.writeFileSync(out, `${JSON.stringify(players)}\n`);
console.log("wrote", out, "count", players.length);
console.log("roles", [...new Set(players.map((p) => p.role))]);
console.log("sample", players.slice(0, 5));
console.log("martinez", players.filter((p) => /martinez/i.test(p.name)));
