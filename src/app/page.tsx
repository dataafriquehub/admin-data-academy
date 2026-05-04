"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getStoredAccessToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (getStoredAccessToken()) router.replace("/dashboard");
    else router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-3 text-neutral-7">
      Chargement…
    </div>
  );
}
