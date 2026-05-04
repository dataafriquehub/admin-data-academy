"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsPage() {
  const { refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const me = await apiFetch<{
          first_name?: string;
          last_name?: string;
          country?: string | null;
          phone_number?: string | null;
        }>("/users/auth/me/");
        if (c) return;
        setFirstName(me.first_name ?? "");
        setLastName(me.last_name ?? "");
        setCountry(me.country ?? "");
        setPhone(me.phone_number ?? "");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/users/auth/me/", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          country: country || undefined,
          phone_number: phone || undefined,
        }),
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-8">Paramètres</h1>
        <p className="text-sm text-neutral-6">
          Profil via `PATCH /users/auth/me/` (email non modifiable).
        </p>
      </div>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Prénom</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Nom</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Pays</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7">Téléphone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
