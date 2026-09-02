import { notFound } from "next/navigation";
import { MatchSimulatorDetailPage } from "@/components/match-simulator/match-simulator-detail-page";
import { MATCH_SIMULATOR_ENABLED } from "@/lib/match-simulator/feature-flag";

export default async function KioskMatchSimulatorDetailRoute({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  if (!MATCH_SIMULATOR_ENABLED) notFound();
  const { eventId } = await params;
  return <MatchSimulatorDetailPage fixtureId={eventId} />;
}
