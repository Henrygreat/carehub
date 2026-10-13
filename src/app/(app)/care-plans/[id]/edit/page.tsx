import { CarePlanForm } from "@/components/care-plan-form";

export default async function EditCarePlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CarePlanForm planId={id} />;
}
