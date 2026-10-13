import { CarePlanDetail } from "@/components/care-plan-detail";

export default async function CarePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CarePlanDetail id={id} />;
}
