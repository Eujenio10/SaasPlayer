import { TrendDetailPage } from "@/components/trends/trend-detail-page";

export default function KioskTrendDetailPage(props: { params: { trendId: string } }) {
  return <TrendDetailPage trendId={props.params.trendId} />;
}
