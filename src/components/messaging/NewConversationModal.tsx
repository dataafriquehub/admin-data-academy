"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import {
  getOrCreateDirectConversation,
  listMessagingContacts,
  type Conversation,
  type MessagingContact,
} from "@/services/messagingService";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  mentor: "Mentor",
  program_creator: "Concepteur",
  student: "Apprenant",
};

const ROLE_TONE: Record<string, string> = {
  admin: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300",
  mentor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  program_creator:
    "border-secondary-3 bg-secondary-5 text-secondary-1",
  student: "border-primary-3 bg-primary-5 text-primary-1",
};

function fullName(contact: MessagingContact): string {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    contact.username ||
    contact.email ||
    `Utilisateur #${contact.id}`
  );
}

function initials(contact: MessagingContact): string {
  const source = fullName(contact);
  const parts = source.split(/[.\s_-]+/).filter(Boolean);
  return (parts[0]?.[0] || "U")
    .concat(parts[1]?.[0] || "")
    .toUpperCase();
}

function normalize(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
};

export default function NewConversationModal({ open, onClose, onCreated }: Props) {
  const [contacts, setContacts] = useState<MessagingContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- réinit + chargement contacts à l'ouverture */
    setLoading(true);
    setError(null);
    setQuery("");
    /* eslint-enable react-hooks/set-state-in-effect */
    listMessagingContacts({ signal: controller.signal })
      .then((list) => {
        if (cancelled) return;
        setContacts(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Chargement des contacts impossible.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return contacts;
    return contacts.filter((c) => {
      const haystack = [
        fullName(c),
        c.email,
        c.username,
        ROLE_LABELS[c.role || ""] || c.role,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [contacts, query]);

  if (!open) return null;

  async function startConversation(contact: MessagingContact) {
    if (pendingId != null) return;
    setPendingId(contact.id);
    setError(null);
    try {
      const conv = await getOrCreateDirectConversation(contact.id);
      onCreated(conv);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’ouvrir la conversation.",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-modal-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-4 bg-neutral-1 shadow-xl animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-4 px-5 py-4">
          <div>
            <h2 className="text-h6 font-semibold text-neutral-8">
              Nouvelle conversation
            </h2>
            <p className="mt-1 text-xs text-neutral-6">
              Choisissez un contact pour démarrer un échange direct.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-6 hover:bg-neutral-3"
            aria-label="Fermer"
          >
            <Icon icon="solar:close-bold" width={18} />
          </button>
        </div>

        <div className="border-b border-neutral-4 px-5 py-3">
          <div className="relative">
            <Icon
              icon="solar:magnifer-linear"
              width={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-5"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un contact…"
              className="w-full rounded-full border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-small text-neutral-6">
              <Icon icon="svg-spinners:90-ring-with-bg" width={16} />
              Chargement des contacts…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 px-6 text-center text-small text-neutral-6">
              <Icon
                icon="solar:danger-circle-linear"
                width={24}
                className="text-secondary-1"
              />
              <p>{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-small text-neutral-6">
              <Icon
                icon="solar:user-cross-linear"
                width={24}
                className="text-neutral-4"
              />
              <p>Aucun contact ne correspond.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-4">
              {filtered.map((contact) => {
                const role = contact.role || "";
                const tone = ROLE_TONE[role] || "border-neutral-4 bg-neutral-2 text-neutral-7";
                return (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => startConversation(contact)}
                      disabled={pendingId != null}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-neutral-3 disabled:opacity-60"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-3 bg-primary-5 text-small font-semibold text-primary-1">
                        {initials(contact)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-semibold text-neutral-8">
                          {fullName(contact)}
                        </span>
                        <span className="block truncate text-xs text-neutral-6">
                          {contact.email}
                        </span>
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
                      >
                        {ROLE_LABELS[role] || role || "—"}
                      </span>
                      {pendingId === contact.id ? (
                        <Icon
                          icon="svg-spinners:90-ring-with-bg"
                          width={16}
                          className="text-primary-1"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
