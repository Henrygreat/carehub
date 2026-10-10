import { StaffDetail } from "@/components/staff-detail";

export const dynamic = "force-dynamic";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StaffDetail id={id} />;
}
