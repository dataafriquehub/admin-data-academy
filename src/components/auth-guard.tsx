"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/lib/types";

export function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, ready, accessToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    if (user?.role === "student") {
      router.replace("/login?reason=forbidden");
      return;
    }
    if (
      allowedRoles &&
      user &&
      !allowedRoles.includes(user.role)
    ) {
      router.replace("/dashboard");
    }
  }, [ready, accessToken, user, router, allowedRoles]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-3 text-neutral-7">
        Chargement…
      </div>
    );
  }

  if (!accessToken || user?.role === "student") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-3 text-neutral-7">
        Redirection…
      </div>
    );
  }

  if (
    allowedRoles &&
    user &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-3 text-neutral-7">
        Redirection…
      </div>
    );
  }

  return <>{children}</>;
}
