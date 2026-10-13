import { VisitDetail } from "@/components/visit-detail";

export const dynamic = "force-dynamic";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VisitDetail id={id} />;
}
