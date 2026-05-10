import type {
  NotificationPriority,
  NotificationRoleTarget,
  NotificationType,
} from "@/services/notificationService";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "general",
  "application",
  "program",
  "quiz",
  "mentorship",
  "message",
  "payment",
  "system",
];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  "low",
  "medium",
  "high",
];

export const NOTIFICATION_ROLES: NotificationRoleTarget[] = [
  "student",
  "mentor",
  "program_creator",
  "admin",
];

export const TYPE_LABELS: Record<NotificationType, string> = {
  general: "Général",
  application: "Candidature",
  program: "Programme",
  quiz: "Quiz",
  mentorship: "Mentorat",
  message: "Message",
  payment: "Paiement",
  system: "Système",
};

export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
};

export const ROLE_LABELS: Record<NotificationRoleTarget, string> = {
  student: "Apprenants",
  mentor: "Mentors",
  program_creator: "Concepteurs",
  admin: "Admins",
};

export const TYPE_ICONS: Record<NotificationType, string> = {
  general: "solar:bell-bold",
  application: "solar:document-text-bold",
  program: "solar:clipboard-list-bold",
  quiz: "solar:notebook-bold",
  mentorship: "solar:users-group-rounded-bold",
  message: "solar:chat-round-dots-bold",
  payment: "solar:wallet-money-bold",
  system: "solar:settings-bold",
};

export function notificationTypeLabel(type: string | undefined): string {
  if (!type) return "Général";
  return TYPE_LABELS[type as NotificationType] ?? type;
}

export function notificationPriorityLabel(p: string | undefined): string {
  if (!p) return "Moyenne";
  return PRIORITY_LABELS[p as NotificationPriority] ?? p;
}

export function notificationTypeIcon(type: string | undefined): string {
  if (!type) return "solar:bell-bold";
  return TYPE_ICONS[type as NotificationType] ?? "solar:bell-bold";
}

export function priorityToneClasses(priority: string | undefined): string {
  if (priority === "high") {
    return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300";
  }
  if (priority === "low") {
    return "border-neutral-4 bg-neutral-2 text-neutral-6";
  }
  return "border-secondary-3 bg-secondary-5 text-secondary-1";
}

export function typeToneClasses(type: string | undefined): string {
  switch (type) {
    case "message":
      return "bg-primary-5 text-primary-1";
    case "quiz":
      return "bg-secondary-5 text-secondary-1";
    case "payment":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
    case "system":
      return "bg-neutral-3 text-neutral-7";
    case "mentorship":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-300";
    case "application":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-300";
    case "program":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
    default:
      return "bg-primary-5 text-primary-1";
  }
}

export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function formatAbsoluteDate(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function notificationLink(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const conversationId = meta.conversation_id;
  if (conversationId != null) {
    return `/dashboard/messaging?c=${encodeURIComponent(String(conversationId))}`;
  }
  if (meta.application_id != null) {
    return `/dashboard/admissions/${encodeURIComponent(String(meta.application_id))}`;
  }
  if (meta.program_id != null) {
    return `/dashboard/programs/${encodeURIComponent(String(meta.program_id))}`;
  }
  return null;
}
