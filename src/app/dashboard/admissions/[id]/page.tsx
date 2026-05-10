"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "@iconify/react";

export default function AdmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  useEffect(() => {
    router.replace(`/dashboard/admissions?application=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-8">
      <div className="rounded-2xl border border-neutral-4 bg-neutral-1 p-6 text-center shadow-sm">
        <Icon
          icon="svg-spinners:90-ring-with-bg"
          width={26}
          className="mx-auto text-neutral-5"
        />
        <p className="mt-3 text-small text-neutral-6">
          Ouverture du dossier dans la console candidatures…
        </p>
        <Link
          href={`/dashboard/admissions?application=${encodeURIComponent(id)}`}
          className="mt-3 inline-flex text-small font-semibold text-primary-1"
        >
          Ouvrir manuellement
        </Link>
      </div>
    </div>
  );
}
