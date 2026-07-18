export function mapPositionToRole(position?: string): "goalkeeper" | "defender" | "midfielder" | "forward" {
  const value = (position ?? "").trim().toUpperCase();
  if (!value || value === "G" || value.startsWith("GK")) return "goalkeeper";
  if (value === "D" || value.startsWith("D") || value.includes("CB") || value.includes("WB")) return "defender";
  if (value === "F" || value.startsWith("F") || value.includes("ST") || value.includes("FW")) return "forward";
  return "midfielder";
}
