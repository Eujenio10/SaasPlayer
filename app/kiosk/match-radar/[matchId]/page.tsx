import { MatchRadarDetailPage } from "@/components/match-radar/match-radar-detail-page";

export default function KioskMatchRadarDetailRoute({
  params
}: {
  params: { matchId: string };
}) {
  return <MatchRadarDetailPage matchId={params.matchId} isPro />;
}
