export function buildGuestPreMatchPreviewText(homeName?: string, awayName?: string): string {
  const home = homeName?.trim() || "la squadra di casa";
  const away = awayName?.trim() || "l'ospite";
  return `Anteprima: ${home} e ${away} si affrontano con ritmo atteso medio-alto. ${home} punta al controllo territoriale, mentre ${away} può essere pericolosa in transizione.`;
}
