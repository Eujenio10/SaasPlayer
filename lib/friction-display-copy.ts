/**
 * Testo friction salvato in cache può ancora contenere paragrafi tecnici sulle coordinate.
 * Sul display pubblico li rimuoviamo e lasciamo solo linguaggio editoriale.
 */
export function frictionExplanationForDisplay(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let t = raw.replace(/\s+/g, " ").trim();

  t = t.replace(/\s*Per il confronto tattico[^.]*\./gi, "");
  t = t.replace(/\s*Per il confronto sull['\u2019]incontro[^.]*\./gi, "");

  const chunks = t.split(/(?<=\.)\s+/).filter(Boolean);
  const kept = chunks.filter((sentence) => {
    const low = sentence.toLowerCase();
    if (/x\s*['′]\s*=\s*100/i.test(sentence) || /y\s*['′]\s*=\s*100/i.test(sentence)) return false;
    if (
      low.includes("coordinate") &&
      (low.includes("invertit") || low.includes("ribalt") || /\b100\s*[-−]\s*x\b/i.test(low))
    )
      return false;
    if (low.includes("dati grezzi") && low.includes("invertit")) return false;
    return true;
  });

  const out = kept.join(" ").replace(/\s+/g, " ").trim();
  return out.length > 0 ? out : null;
}
