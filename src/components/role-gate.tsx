"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/lib/types";

export function RoleGate({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <Card>
        <p className="text-neutral-7">Cette page est réservée à des rôles spécifiques.</p>
      </Card>
    );
  }
  return <>{children}</>;
}
