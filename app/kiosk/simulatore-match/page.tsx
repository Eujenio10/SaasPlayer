import { notFound } from "next/navigation";
import { MatchSimulatorListPage } from "@/components/match-simulator/match-simulator-list-page";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";

export default function KioskMatchSimulatorPage() {
  if (!MATCH_SIMULATOR_ENABLED) notFound();
  return <MatchSimulatorListPage />;
}
