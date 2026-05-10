import { Suspense } from "react";
import AdmissionsScreen from "./admissions-screen";

export default function AdmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-6 lg:px-8">
          <div className="h-40 animate-pulse rounded-2xl border border-neutral-4 bg-neutral-2" />
        </div>
      }
    >
      <AdmissionsScreen />
    </Suspense>
  );
}
