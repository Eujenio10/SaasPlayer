export const COMING_SOON_MESSAGE = "Presto in arrivo!";

export function isComingSoonRoute(route: string): boolean {
  const path = route.split("?")[0].trim();
  return path === "/trends" || path.startsWith("/trends/") || path === "/simulator" || path.startsWith("/simulator/");
}
