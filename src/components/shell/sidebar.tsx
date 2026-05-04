"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { navForRole } from "@/lib/navigation";
import { useAuth } from "@/providers/auth-provider";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = navForRole(user?.role);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-neutral-4 bg-neutral-1 md:h-auto md:w-56 md:border-b-0 md:border-r">
      <div className="flex h-14 items-center border-b border-neutral-4 px-4 md:border-b-0">
        <span className="text-lg font-semibold text-neutral-8">Data Academy</span>
      </div>
      <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:gap-0.5 md:p-3">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition md:gap-3 ${
                active
                  ? "bg-primary-1/10 text-primary-1"
                  : "text-neutral-7 hover:bg-neutral-2"
              }`}
            >
              <Icon icon={item.icon} className="size-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
