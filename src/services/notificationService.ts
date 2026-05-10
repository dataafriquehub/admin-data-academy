import { apiFetch, unwrapArray } from "@/lib/api";

export type NotificationType =
  | "general"
  | "application"
  | "program"
  | "quiz"
  | "mentorship"
  | "message"
  | "payment"
  | "system";

export type NotificationPriority = "low" | "medium" | "high";

export type NotificationRoleTarget =
  | "student"
  | "mentor"
  | "program_creator"
  | "admin";

export type Notification = {
  id: number;
  title?: string;
  subject?: string;
  message?: string;
  body?: string;
  content?: string;
  type?: NotificationType | string;
  priority?: NotificationPriority | string;
  metadata?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string;
};

export type SendNotificationPayload = {
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  roles?: NotificationRoleTarget[];
  user_ids?: number[];
};

export type SendNotificationResponse = {
  created?: number;
  email_sent?: number;
  target_roles?: string[];
  target_user_ids?: number[];
  [key: string]: unknown;
};

export type QuizDeadlinePayload = {
  quiz_id: number;
  application_ids?: number[];
  due_at?: string | null;
  title?: string;
  message?: string;
};

export type QuizDeadlinePreviewResponse = {
  quiz_id?: number;
  target_application_ids?: number[];
  recipient_count?: number;
  recipients?: { id: number; email: string }[];
  [key: string]: unknown;
};

export type QuizDeadlineSendResponse = {
  created?: number;
  email_sent?: number;
  quiz_id?: number;
  target_application_ids?: number[];
  [key: string]: unknown;
};

// ────────────────────────────────────────────────────────────────────────────
// Inbox
// ────────────────────────────────────────────────────────────────────────────

export async function listMyNotifications(
  filters: { isRead?: boolean; type?: string } = {},
  init?: { signal?: AbortSignal },
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (filters.isRead === true) params.set("is_read", "true");
  if (filters.isRead === false) params.set("is_read", "false");
  if (filters.type) params.set("type", filters.type);
  const qs = params.toString();
  const path = qs ? `/notifications/?${qs}` : "/notifications/";
  const data = await apiFetch<unknown>(path, { signal: init?.signal });
  return unwrapArray<Notification>(data);
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const data = await apiFetch<unknown>("/notifications/unread-count/");
  if (typeof data === "number") return data;
  if (data && typeof data === "object") {
    const obj = data as { unread_count?: unknown; count?: unknown };
    if (typeof obj.unread_count === "number") return obj.unread_count;
    if (typeof obj.count === "number") return obj.count;
  }
  return 0;
}

export async function markNotificationAsRead(
  id: number | string,
): Promise<Notification> {
  return apiFetch<Notification>(
    `/notifications/${encodeURIComponent(String(id))}/read/`,
    { method: "PATCH", body: JSON.stringify({}) },
  );
}

export async function markAllNotificationsAsRead(): Promise<{
  updated: number;
}> {
  const res = await apiFetch<unknown>("/notifications/read-all/", {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  if (res && typeof res === "object" && "updated" in res) {
    const u = (res as { updated?: unknown }).updated;
    return { updated: typeof u === "number" ? u : 0 };
  }
  return { updated: 0 };
}

// ────────────────────────────────────────────────────────────────────────────
// Diffusion ciblée (admin / superuser)
// ────────────────────────────────────────────────────────────────────────────

export async function sendNotification(
  payload: SendNotificationPayload,
): Promise<SendNotificationResponse> {
  return apiFetch<SendNotificationResponse>("/notifications/send/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Rappels deadline quiz (admin / superuser)
// ────────────────────────────────────────────────────────────────────────────

export async function previewQuizDeadlineNotification(
  payload: QuizDeadlinePayload,
): Promise<QuizDeadlinePreviewResponse> {
  return apiFetch<QuizDeadlinePreviewResponse>(
    "/notifications/quiz-deadlines/preview/",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function sendQuizDeadlineNotification(
  payload: QuizDeadlinePayload,
): Promise<QuizDeadlineSendResponse> {
  return apiFetch<QuizDeadlineSendResponse>(
    "/notifications/quiz-deadlines/send/",
    { method: "POST", body: JSON.stringify(payload) },
  );
}
