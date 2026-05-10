"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { NAV_ITEMS, SETTING_ITEMS, type NavItem } from "@/lib/navigation";

type Props = {
  children: React.ReactNode;
  topBarLeft?: React.ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (v: string) => void;
};

function findActiveKey(pathname: string): string | undefined {
  const all = [...NAV_ITEMS, ...SETTING_ITEMS];
  // Match le plus long en premier (dashboard ne doit pas matcher /dashboard/programs)
  const sorted = [...all].sort((a, b) => b.href.length - a.href.length);
  const matched = sorted.find((item) => {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  return matched?.key;
}

const Layout = ({
  children,
  topBarLeft,
  showSearch = false,
  searchPlaceholder,
  onSearch,
}: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const activePage = findActiveKey(pathname);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar_collapsed") === "true";
    /* eslint-disable react-hooks/set-state-in-effect -- état initial depuis localStorage / window */
    setCollapsed(stored);
    setIsDesktop(window.innerWidth >= 1024);
    /* eslint-enable react-hooks/set-state-in-effect */
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleNavigate = (item: NavItem) => {
    setMobileOpen(false);
    router.push(item.href);
  };

  const sidebarWidth = collapsed ? 72 : 224;

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-3">
      {/* Overlay mobile */}
      <div
        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        style={{
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? "auto" : "none",
          transition: "opacity 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-full z-40 flex flex-col bg-neutral-1 border-r border-neutral-4 lg:relative lg:shrink-0"
        style={{
          width: `${sidebarWidth}px`,
          minWidth: `${sidebarWidth}px`,
          transform:
            isDesktop || mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition:
            "width 0.35s cubic-bezier(0.4,0,0.2,1), min-width 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            collapsed={isDesktop ? collapsed : false}
          />
        </div>

        {/* Bouton collapse — desktop uniquement */}
        <button
          onClick={toggleCollapsed}
          type="button"
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-neutral-1 border border-neutral-4 items-center justify-center text-neutral-6 hover:text-primary-1 hover:border-primary-1 transition-all duration-200 shadow-sm z-10"
          title={collapsed ? "Déplier la sidebar" : "Réduire la sidebar"}
          aria-label={collapsed ? "Déplier la sidebar" : "Réduire la sidebar"}
        >
          <Icon
            icon="solar:alt-arrow-left-bold"
            width={12}
            height={12}
            className={`transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </aside>

      {/* Zone droite */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <div className="shrink-0">
          <TopBar
            left={topBarLeft}
            showSearch={showSearch}
            searchPlaceholder={searchPlaceholder}
            onSearch={onSearch}
            onMenuClick={() => setMobileOpen(true)}
          />
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
