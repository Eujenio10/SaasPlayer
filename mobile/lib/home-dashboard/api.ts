import { fetchHomeDashboard } from "@/lib/api";
import type { HomeDashboardData } from "@/lib/home-dashboard/types";

export async function loadHomeDashboard(): Promise<HomeDashboardData> {
  return fetchHomeDashboard();
}
