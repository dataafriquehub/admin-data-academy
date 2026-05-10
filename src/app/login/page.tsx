"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { ApiError, getStoredAccessToken } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/providers/auth-provider";

function LoginForm() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const reason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (getStoredAccessToken()) router.replace("/dashboard");
  }, [router]);

  function describeLoginError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) return "Identifiants invalides.";
      if (err.status >= 500) {
        return `Erreur serveur (${err.status}). Réessayez plus tard.`;
      }
      return err.message || "Connexion impossible.";
    }
    return err instanceof Error ? err.message : "Connexion impossible.";
  }

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
      setError(describeLoginError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-1 text-neutral-8">
      {/* Dôme bas en arc — bordure haute arrondie comme une coupole */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 bottom-0 h-[58%]"
        style={{
          background:
            "linear-gradient(180deg, #03172D 0%, #03172D 55%, #061f3a 100%)",
          borderTopLeftRadius: "50% 22%",
          borderTopRightRadius: "50% 22%",
          boxShadow:
            "0 -30px 80px -40px rgba(8,114,224,0.35), 0 -60px 120px -60px rgba(255,138,0,0.18)",
        }}
      />
      {/* Halo bleu/orange discret (sidebar palette) pour réveiller la zone basse */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%]"
        style={{
          background:
            "radial-gradient(60% 45% at 25% 95%, rgba(8,114,224,0.45) 0%, transparent 70%), radial-gradient(50% 40% at 80% 100%, rgba(255,138,0,0.28) 0%, transparent 70%)",
        }}
      />
      {/* Motif points fins */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Halo bleu très léger en haut, sur le fond clair */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40%]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(8,114,224,0.12) 0%, transparent 70%)",
        }}
      />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral-4 bg-neutral-1/90 px-3 text-xs font-semibold text-neutral-7 shadow-sm backdrop-blur">
            <Icon icon="solar:global-bold" width={14} />
            FR
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              isDark ? "Passer au thème clair" : "Passer au thème sombre"
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-4 bg-neutral-1/90 text-neutral-7 shadow-sm transition hover:bg-neutral-3"
          >
            <Icon
              icon={isDark ? "solar:sun-bold" : "solar:moon-bold"}
              width={16}
            />
          </button>
        </div>

        <section className="w-full max-w-[460px] rounded-2xl border border-neutral-4 bg-neutral-1 p-6 shadow-[0_30px_60px_-20px_rgba(3,23,45,0.45)]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-3 bg-primary-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- asset public SVG */}
              <img
                src="/academy-logo.svg"
                alt="Data Academy"
                className="h-9 w-9 object-contain"
              />
            </div>
            <h1 className="text-h5 font-semibold text-neutral-8">
              Se connecter
            </h1>
            <p className="mt-1 text-small text-neutral-6">
              Accès réservé à l’équipe Data Academy.
            </p>
          </div>

          {reason === "forbidden" ? (
            <div
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-small text-red-600 dark:text-red-300"
              role="alert"
            >
              <Icon
                icon="solar:lock-keyhole-bold"
                width={16}
                className="mt-0.5 shrink-0"
              />
              <p>
                Accès refusé : ce compte n’a pas accès à l’administration.
              </p>
            </div>
          ) : null}

          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1 text-small text-neutral-7">
              <span className="font-medium">Adresse email</span>
              <span className="relative">
                <Icon
                  icon="solar:letter-bold"
                  width={16}
                  className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
                />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  disabled={pending}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vous@organisation.org"
                  title="Adresse email"
                  className="h-12 w-full rounded-xl border border-neutral-4 bg-neutral-2 px-10 text-small text-neutral-8 placeholder:text-neutral-5 transition focus:border-primary-3 focus:bg-neutral-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </span>
            </label>

            <label className="flex flex-col gap-1 text-small text-neutral-7">
              <span className="font-medium">Mot de passe</span>
              <span className="relative">
                <Icon
                  icon="solar:lock-keyhole-bold"
                  width={16}
                  className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-5"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={pending}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Votre mot de passe"
                  title="Mot de passe"
                  className="h-12 w-full rounded-xl border border-neutral-4 bg-neutral-2 px-10 pr-12 text-small text-neutral-8 placeholder:text-neutral-5 transition focus:border-primary-3 focus:bg-neutral-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={pending}
                  className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-6 transition hover:bg-neutral-3 hover:text-neutral-8 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  <Icon
                    icon={showPassword ? "solar:eye-closed-bold" : "solar:eye-bold"}
                    width={16}
                  />
                </button>
              </span>
            </label>

            {error ? (
              <div
                className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-small text-red-600 dark:text-red-300"
                role="alert"
              >
                <Icon
                  icon="solar:danger-triangle-bold"
                  width={16}
                  className="mt-0.5 shrink-0"
                />
                <p>{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-1 px-4 text-small font-semibold text-white shadow-sm transition hover:bg-primary-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon
                icon={
                  pending
                    ? "svg-spinners:90-ring-with-bg"
                    : "solar:login-3-bold"
                }
                width={16}
              />
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </section>

        <footer className="mt-12 text-center">
          <div className="inline-flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- asset public SVG */}
            <img
              src="/academy-logo.svg"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
            />
            <div className="text-left leading-tight">
              <p className="text-h6 font-bold tracking-wide">
                <span style={{ color: "#2F80ED" }}>DATA</span>
                <span style={{ color: "#F2994A" }}>ACADEMY</span>
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">
                Admin
              </p>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-white/75">
            Formation et pilotage des parcours — espace équipe Data Academy.
          </p>
        </footer>
      </main>
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
