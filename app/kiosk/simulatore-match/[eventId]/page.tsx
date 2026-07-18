import { MatchSimulatorDetailPage } from "@/components/match-simulator/match-simulator-detail-page";

export default async function KioskMatchSimulatorDetailRoute({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <MatchSimulatorDetailPage fixtureId={eventId} />;
}
