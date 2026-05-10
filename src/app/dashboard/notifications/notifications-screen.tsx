"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/auth-provider";
import InboxSection from "@/components/notifications/InboxSection";
import BroadcastComposer from "@/components/notifications/BroadcastComposer";
import QuizReminderWizard from "@/components/notifications/QuizReminderWizard";

type Tab = "inbox" | "broadcast";
type BroadcastSubTab = "targeted" | "quiz";

export default function NotificationsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<Tab>("inbox");
  const [subTab, setSubTab] = useState<BroadcastSubTab>("targeted");
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h4 font-semibold text-neutral-8">
              Centre de notifications
            </h1>
            {unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary-3 bg-primary-5 px-2.5 py-0.5 text-xs font-semibold text-primary-1">
                <Icon icon="solar:bell-bing-bold" width={12} />
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-small text-neutral-6">
            Messages système, alertes métier et campagnes ciblées.
          </p>
        </div>

        {isAdmin ? (
          <nav
            aria-label="Onglets notifications"
            className="inline-flex w-full overflow-hidden rounded-2xl border border-neutral-4 bg-neutral-1 p-1 text-xs lg:w-auto"
          >
            <button
              type="button"
              onClick={() => setTab("inbox")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                tab === "inbox"
                  ? "bg-primary-1 text-white"
                  : "text-neutral-7 hover:bg-neutral-3"
              }`}
            >
              <Icon icon="solar:inbox-bold" width={14} />
              Boîte de réception
            </button>
            <button
              type="button"
              onClick={() => setTab("broadcast")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                tab === "broadcast"
                  ? "bg-primary-1 text-white"
                  : "text-neutral-7 hover:bg-neutral-3"
              }`}
            >
              <Icon icon="solar:plain-bold" width={14} />
              Diffusion
            </button>
          </nav>
        ) : null}
      </header>

      {tab === "inbox" || !isAdmin ? (
        <InboxSection onUnreadChange={setUnreadCount} />
      ) : (
        <div className="space-y-4">
          <div className="inline-flex rounded-2xl border border-neutral-4 bg-neutral-1 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSubTab("targeted")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                subTab === "targeted"
                  ? "bg-neutral-3 text-neutral-8"
                  : "text-neutral-6 hover:bg-neutral-3"
              }`}
            >
              <Icon icon="solar:bell-bing-bold" width={14} />
              Message ciblé
            </button>
            <button
              type="button"
              onClick={() => setSubTab("quiz")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
                subTab === "quiz"
                  ? "bg-neutral-3 text-neutral-8"
                  : "text-neutral-6 hover:bg-neutral-3"
              }`}
            >
              <Icon icon="solar:notebook-bold" width={14} />
              Rappels quiz
            </button>
          </div>

          {subTab === "targeted" ? (
            <BroadcastComposer />
          ) : (
            <QuizReminderWizard />
          )}
        </div>
      )}

      {!isAdmin ? (
        <p className="rounded-xl border border-dashed border-neutral-4 bg-neutral-2 p-3 text-xs text-neutral-6">
          <Icon
            icon="solar:lock-keyhole-minimalistic-bold"
            width={14}
            className="mr-1 inline align-text-bottom"
          />
          La diffusion ciblée et les rappels quiz sont réservés aux comptes
          administrateurs ; rapprochez-vous d’un admin pour envoyer une campagne.
        </p>
      ) : null}
    </div>
  );
}
