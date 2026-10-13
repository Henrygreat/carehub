import { ShiftDetail } from "@/components/shift-detail";

export const dynamic = "force-dynamic";

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShiftDetail id={id} />;
}
