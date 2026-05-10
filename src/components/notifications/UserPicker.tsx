"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { apiFetch, unwrapArray } from "@/lib/api";

type PickerUser = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
};

function fullName(u: PickerUser): string {
  return (
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    u.username ||
    u.email ||
    `Utilisateur #${u.id}`
  );
}

function normalize(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

type Props = {
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
};

export default function UserPicker({ value, onChange, disabled }: Props) {
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- chargement initial liste utilisateurs */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    apiFetch<unknown>("/users/auth/users/")
      .then((data) => {
        if (cancelled) return;
        setUsers(unwrapArray<PickerUser>(data));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les utilisateurs.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedUsers = useMemo(
    () => users.filter((u) => value.includes(u.id)),
    [users, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return users.slice(0, 8);
    return users
      .filter((u) => {
        const haystack = [fullName(u), u.email, u.username, u.role]
          .map(normalize)
          .join(" ");
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [users, search]);

  function toggle(id: number) {
    if (disabled) return;
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedUsers.length === 0 ? (
          <span className="text-xs text-neutral-5 italic">
            Aucun destinataire individuel sélectionné.
          </span>
        ) : (
          selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-3 bg-primary-5 px-2.5 py-1 text-xs text-primary-1"
            >
              <Icon icon="solar:user-bold" width={12} />
              <span className="max-w-[140px] truncate">{fullName(u)}</span>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                disabled={disabled}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary-3/30"
                aria-label={`Retirer ${fullName(u)}`}
              >
                <Icon icon="solar:close-bold" width={10} />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <Icon
          icon="solar:magnifer-linear"
          width={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-5"
        />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={
            loading
              ? "Chargement…"
              : "Rechercher un utilisateur (nom, email, rôle)…"
          }
          disabled={loading || disabled}
          className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-9 py-2 text-small text-neutral-8 placeholder:text-neutral-5 focus:border-primary-3 focus:bg-neutral-1 focus:outline-none disabled:opacity-60"
        />
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      {open && !loading && filtered.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto rounded-xl border border-neutral-4 bg-neutral-1 shadow-sm">
          {filtered.map((u) => {
            const checked = value.includes(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                    checked
                      ? "bg-primary-5 text-primary-1"
                      : "hover:bg-neutral-3"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-4">
                    {checked ? (
                      <Icon
                        icon="solar:check-bold"
                        width={12}
                        className="text-primary-1"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold">
                      {fullName(u)}
                    </span>
                    <span className="block truncate text-xs text-neutral-6">
                      {u.email}
                    </span>
                  </span>
                  {u.role ? (
                    <span className="rounded-full bg-neutral-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-6">
                      {u.role}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
