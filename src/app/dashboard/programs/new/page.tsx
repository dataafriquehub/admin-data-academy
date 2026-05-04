"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export default function NewProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tag: "",
    length_in_weeks: 8,
    start_date: "",
    end_date: "",
    price: "0",
    currency: "EUR" as "USD" | "EUR" | "XOF",
    cover_url: "",
  });

  if (user?.role !== "admin" && user?.role !== "program_creator") {
    return (
      <Card>
        <p className="text-neutral-7">Seuls l’administrateur et le concepteur peuvent créer un programme.</p>
        <Link href="/dashboard/programs" className="mt-4 inline-block text-primary-1">
          Retour
        </Link>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        tag: form.tag,
        length_in_weeks: form.length_in_weeks,
        start_date: form.start_date,
        end_date: form.end_date,
        price: form.price,
        currency: form.currency,
        ...(form.cover_url.trim() ? { cover_url: form.cover_url.trim() } : {}),
      };
      const created = await apiFetch<{ id: number }>("/programs/programs/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/dashboard/programs/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/programs" className="text-sm text-primary-1">
          ← Programmes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-8">
          Nouveau programme
        </h1>
      </div>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Titre</label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Description</label>
            <textarea
              required
              className="min-h-[120px] w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base text-neutral-8"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Tag</label>
            <Input
              required
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-neutral-7">
                Durée (semaines)
              </label>
              <Input
                type="number"
                min={1}
                required
                value={form.length_in_weeks}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    length_in_weeks: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Devise</label>
              <select
                className="w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base text-neutral-8"
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    currency: e.target.value as typeof form.currency,
                  }))
                }
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="XOF">XOF</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Début</label>
              <Input
                type="date"
                required
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-7">Fin</label>
              <Input
                type="date"
                required
                value={form.end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Prix</label>
            <Input
              required
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">
              Couverture (URL, optionnel)
            </label>
            <Input
              type="url"
              placeholder="https://…"
              value={form.cover_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, cover_url: e.target.value }))
              }
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Créer"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
