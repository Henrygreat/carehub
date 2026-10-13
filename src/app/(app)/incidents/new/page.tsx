import { Suspense } from "react";
import { IncidentForm } from "@/components/incident-form";

export default function NewIncidentPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-slate-500">Loading...</p>}>
      <IncidentForm />
    </Suspense>
  );
}
