export function getApiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (base) return base.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000/api";
  }
  throw new Error("NEXT_PUBLIC_API_BASE_URL n'est pas défini");
}

export function getJwtRefreshPath(): string {
  return process.env.NEXT_PUBLIC_JWT_REFRESH_PATH ?? "/users/auth/token/refresh/";
}
