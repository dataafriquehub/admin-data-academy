import { getApiBaseUrl, getJwtRefreshPath } from "./config";
import type { LoginResponse, User } from "./types";

const STORAGE_ACCESS = "da_access";
const STORAGE_REFRESH = "da_refresh";

let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_ACCESS);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_REFRESH);
}

export function persistTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ACCESS, access);
  localStorage.setItem(STORAGE_REFRESH, refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data: Record<string, unknown> = await res.json();
    const detail = data.detail;
    if (typeof detail === "string") return new ApiError(detail, res.status, data);
    if (Array.isArray(detail)) {
      return new ApiError(JSON.stringify(detail), res.status, data);
    }
    if (typeof data.error === "string") {
      return new ApiError(data.error, res.status, data);
    }
    return new ApiError(JSON.stringify(data), res.status, data);
  } catch {
    return new ApiError(res.statusText || `Erreur ${res.status}`, res.status);
  }
}

async function tryRefreshOnce(): Promise<boolean> {
  const refresh = getStoredRefreshToken();
  if (!refresh) return false;
  const base = getApiBaseUrl();
  const path = getJwtRefreshPath().startsWith("/")
    ? getJwtRefreshPath()
    : `/${getJwtRefreshPath()}`;
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access?: string };
    if (!data.access) return false;
    localStorage.setItem(STORAGE_ACCESS, data.access);
    return true;
  } catch {
    return false;
  }
}

function refreshChain(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefreshOnce().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export type ApiFetchOptions = RequestInit & {
  auth?: boolean;
  skipRefresh?: boolean;
};

export async function apiFetch<T>(
  path: string,
  init: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, skipRefresh = false, ...rest } = init;
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(rest.headers);
  if (auth) {
    const access = getStoredAccessToken();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }
  if (
    rest.body &&
    !(rest.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(url, { ...rest, headers });

  if (res.status === 401 && auth && !skipRefresh) {
    const ok = await refreshChain();
    if (ok) {
      const retryHeaders = new Headers(rest.headers);
      const access = getStoredAccessToken();
      if (access) retryHeaders.set("Authorization", `Bearer ${access}`);
      if (
        rest.body &&
        !(rest.body instanceof FormData) &&
        !retryHeaders.has("Content-Type")
      ) {
        retryHeaders.set("Content-Type", "application/json");
      }
      res = await fetch(url, { ...rest, headers: retryHeaders });
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      clearTokens();
    }
    throw await parseError(res);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/users/login/", {
    method: "POST",
    auth: false,
    skipRefresh: true,
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutRequest(): Promise<void> {
  const refresh = getStoredRefreshToken();
  if (!refresh) return;
  try {
    await apiFetch("/users/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
      skipRefresh: true,
    });
  } catch {
    /* déconnexion locale même si l'API échoue */
  }
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>("/users/auth/me/");
}

export function unwrapArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results: unknown }).results;
    if (Array.isArray(r)) return r as T[];
  }
  return [];
}
