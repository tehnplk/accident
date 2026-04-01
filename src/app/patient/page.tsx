import { Suspense } from "react";
import { PatientDataGrid } from "@/components/patient-data-grid";

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="px-4 py-6 text-slate-600">Loading patient grid...</div>}>
      <PatientDataGrid />
    </Suspense>
  );
}
