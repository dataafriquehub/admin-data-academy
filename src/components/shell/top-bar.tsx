"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export function TopBar() {
  const { user, logout } = useAuth();
  const { toggle, theme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-4 bg-neutral-1 px-4 md:px-6">
      <p className="truncate text-sm text-neutral-7">
        <span className="font-medium text-neutral-8">
          {user?.first_name || user?.email}
        </span>
        {user?.role ? (
          <span className="ml-2 rounded-lg bg-neutral-2 px-2 py-0.5 text-xs capitalize text-neutral-6">
            {user.role.replace("_", " ")}
          </span>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          className="!p-2"
          onClick={toggle}
          aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
        >
          <Icon
            icon={
              theme === "dark"
                ? "solar:sun-bold-duotone"
                : "solar:moon-bold-duotone"
            }
            className="size-5"
          />
        </Button>
        <Button variant="ghost" type="button" onClick={() => logout()}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
