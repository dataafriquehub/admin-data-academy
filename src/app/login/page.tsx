"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAccessToken } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

function LoginForm() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (getStoredAccessToken()) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      const raw = localStorage.getItem("da_user");
      const u = raw ? (JSON.parse(raw) as { role: string }) : null;
      if (u?.role === "student") {
        await logout();
        setError(
          "L’accès au backoffice est réservé aux équipes (admin, concepteur, mentor).",
        );
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-3 p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-neutral-8">Connexion backoffice</h1>
        <p className="mt-1 text-sm text-neutral-6">
          API Data Academy — identifiants équipe
        </p>
        {reason === "forbidden" ? (
          <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            Accès refusé : compte apprenant ou droits insuffisants.
          </p>
        ) : null}
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm text-neutral-7" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-7" htmlFor="password">
              Mot de passe
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-3">
          Chargement…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
