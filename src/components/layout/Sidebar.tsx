"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/auth-provider";
import { navForRole, settingsForRole, type NavItem } from "@/lib/navigation";
import { getConversationsUnreadCount } from "@/services/messagingService";

const MESSAGES_BADGE_POLL_MS = 30_000;

type Props = {
  activePage?: string;
  onNavigate: (item: NavItem) => void;
  collapsed?: boolean;
};

const Sidebar = ({ activePage, onNavigate, collapsed = false }: Props) => {
  const { user } = useAuth();
  const [messagesUnread, setMessagesUnread] = useState(0);

  const refreshMessagesBadge = useCallback(async () => {
    try {
      const { total } = await getConversationsUnreadCount();
      setMessagesUnread(Number(total) || 0);
    } catch {
      /* silencieux : badge → 0 si l'API échoue */
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- polling badge messages */
    refreshMessagesBadge();
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(refreshMessagesBadge, MESSAGES_BADGE_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshMessagesBadge]);

  useEffect(() => {
    if (activePage === "community") {
      /* eslint-disable react-hooks/set-state-in-effect -- refresh on activation */
      refreshMessagesBadge();
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [activePage, refreshMessagesBadge]);

  const badgeFor = (key: string) => {
    if (key === "community") return messagesUnread;
    return 0;
  };

  const navItems = navForRole(user?.role);
  const settingItems = settingsForRole(user?.role);

  const labelStyle: React.CSSProperties = {
    maxWidth: collapsed ? "0px" : "160px",
    opacity: collapsed ? 0 : 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    transition: collapsed
      ? "opacity 0.15s ease, max-width 0.3s cubic-bezier(0.4,0,0.2,1) 0.05s"
      : "max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease 0.15s",
  };

  const renderNavBtn = (item: NavItem) => {
    const isActive = activePage === item.key;
    const badge = badgeFor(item.key);
    return (
      <button
        key={item.key}
        onClick={() => onNavigate(item)}
        title={collapsed ? item.label : undefined}
        type="button"
        className={`
          relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-small
          cursor-pointer text-left w-full
          transition-colors duration-150
          ${
            isActive
              ? "bg-primary-5 text-primary-1 font-semibold"
              : "text-neutral-8 hover:bg-neutral-3 font-normal"
          }
        `}
      >
        <span className="relative shrink-0">
          <Icon
            icon={item.icon}
            width={20}
            height={20}
            className={isActive ? "text-primary-1" : "text-neutral-8"}
          />
          {collapsed && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary-1 text-white text-[9px] font-bold flex items-center justify-center">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span
          style={labelStyle}
          className="flex items-center justify-between gap-2 flex-1 min-w-0"
        >
          <span className="truncate">{item.label}</span>
          {!collapsed && badge > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-primary-1 text-white text-[10px] font-bold shrink-0">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col justify-between h-full py-6 px-3">
      {/* ── Logo ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-0 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/academy-logo.svg"
            alt="Academy Logo"
            className="h-8 w-auto shrink-0"
          />
          <span
            className="font-bold text-sm tracking-wide leading-none ml-2.5"
            style={{
              maxWidth: collapsed ? "0px" : "160px",
              opacity: collapsed ? 0 : 1,
              overflow: "hidden",
              whiteSpace: "nowrap",
              transition: collapsed
                ? "opacity 0.15s ease, max-width 0.3s cubic-bezier(0.4,0,0.2,1) 0.05s"
                : "max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease 0.15s",
            }}
          >
            <span style={{ color: "#2F80ED" }}>DATA</span>
            <span style={{ color: "#F2994A" }}>ACADEMY</span>
            <span className="ml-1 text-[10px] uppercase tracking-widest text-neutral-5">
              admin
            </span>
          </span>
        </div>

        <p
          className="text-neutral-5 text-xs font-semibold uppercase tracking-widest px-1"
          style={{
            maxHeight: collapsed ? "0px" : "24px",
            opacity: collapsed ? 0 : 1,
            overflow: "hidden",
            marginBottom: collapsed ? "0px" : "8px",
            transition: collapsed
              ? "opacity 0.15s ease, max-height 0.3s cubic-bezier(0.4,0,0.2,1) 0.05s, margin-bottom 0.3s ease 0.05s"
              : "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease 0.15s, margin-bottom 0.3s ease",
          }}
        >
          Navigation
        </p>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(renderNavBtn)}
        </nav>
      </div>

      {/* ── Section bas : Paramètres ── */}
      <div>
        <p
          className="text-neutral-5 text-xs font-semibold uppercase tracking-widest px-1"
          style={{
            maxHeight: collapsed ? "0px" : "24px",
            opacity: collapsed ? 0 : 1,
            overflow: "hidden",
            marginBottom: collapsed ? "0px" : "8px",
            transition: collapsed
              ? "opacity 0.15s ease, max-height 0.3s cubic-bezier(0.4,0,0.2,1) 0.05s, margin-bottom 0.3s ease 0.05s"
              : "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease 0.15s, margin-bottom 0.3s ease",
          }}
        >
          Paramètres
        </p>

        <nav className="flex flex-col gap-0.5">
          {settingItems.map(renderNavBtn)}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
