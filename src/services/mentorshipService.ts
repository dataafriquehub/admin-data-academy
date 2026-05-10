import { apiFetch, getStoredAccessToken, unwrapArray } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/config";
import { parseContentDispositionFilename } from "@/utils/parseContentDisposition";

export type ProgramSummary = {
  id?: number;
  title?: string;
  cover_url?: string | null;
};

export type Session = {
  id: number;
  program: number;
  program_details?: ProgramSummary | null;
  mentor?: number | null;
  title: string;
  description: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  url: string;
  recording_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SessionPayload = {
  program: number;
  title: string;
  description: string;
  scheduled_at: string;
  duration_minutes?: number;
  url: string;
  recording_url?: string | null;
  mentor?: number | null;
};

export type SessionAttendee = {
  id: number;
  session: number;
  user: number;
  attended?: boolean;
  joined_at?: string | null;
};

export type AttendeePayload = {
  session: number;
  user: number;
  attended?: boolean;
};

// ────────────────────────────────────────────────────────────────────────────
// Sessions staff
// ────────────────────────────────────────────────────────────────────────────

export async function listSessions(
  init?: { signal?: AbortSignal },
): Promise<Session[]> {
  const data = await apiFetch<unknown>("/mentorship/sessions/", {
    signal: init?.signal,
  });
  return unwrapArray<Session>(data);
}

export async function getSession(id: number | string): Promise<Session> {
  return apiFetch<Session>(
    `/mentorship/sessions/${encodeURIComponent(String(id))}/`,
  );
}

export async function createSession(payload: SessionPayload): Promise<Session> {
  return apiFetch<Session>("/mentorship/sessions/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSession(
  id: number | string,
  payload: Partial<SessionPayload>,
): Promise<Session> {
  return apiFetch<Session>(
    `/mentorship/sessions/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteSession(id: number | string): Promise<void> {
  await apiFetch(
    `/mentorship/sessions/${encodeURIComponent(String(id))}/`,
    { method: "DELETE" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ICS calendar download (auth + blob — pas de lien nu)
// ────────────────────────────────────────────────────────────────────────────

export type CalendarBlob = {
  blob: Blob;
  filename: string;
};

export async function downloadSessionCalendarBlob(
  id: number | string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CalendarBlob> {
  const base = getApiBaseUrl();
  const token = getStoredAccessToken();
  const res = await fetch(
    `${base}/mentorship/sessions/${encodeURIComponent(String(id))}/calendar/`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    },
  );
  if (!res.ok) {
    throw new Error(`Téléchargement calendrier impossible (${res.status})`);
  }
  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get("Content-Disposition")) ||
    `session-${id}.ics`;
  return { blob, filename };
}

// ────────────────────────────────────────────────────────────────────────────
// Attendees
// ────────────────────────────────────────────────────────────────────────────

export async function listAttendees(
  init?: { signal?: AbortSignal },
): Promise<SessionAttendee[]> {
  const data = await apiFetch<unknown>("/mentorship/attendees/", {
    signal: init?.signal,
  });
  return unwrapArray<SessionAttendee>(data);
}

export async function addAttendee(
  payload: AttendeePayload,
): Promise<SessionAttendee> {
  return apiFetch<SessionAttendee>("/mentorship/attendees/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAttendee(
  id: number | string,
  payload: Partial<AttendeePayload>,
): Promise<SessionAttendee> {
  return apiFetch<SessionAttendee>(
    `/mentorship/attendees/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function removeAttendee(id: number | string): Promise<void> {
  await apiFetch(
    `/mentorship/attendees/${encodeURIComponent(String(id))}/`,
    { method: "DELETE" },
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

export function getSessionStartDate(session: Session): Date | null {
  const d = new Date(session.scheduled_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getSessionEndDate(session: Session): Date | null {
  const start = getSessionStartDate(session);
  if (!start) return null;
  const minutes = Number(session.duration_minutes) || 0;
  return new Date(start.getTime() + minutes * 60_000);
}

export type SessionTemporalStatus = "upcoming" | "live" | "past" | "unknown";

export function getSessionTemporalStatus(
  session: Session,
  now: Date = new Date(),
): SessionTemporalStatus {
  const start = getSessionStartDate(session);
  if (!start) return "unknown";
  const end = getSessionEndDate(session) || start;
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "live";
}
