import type { UserRole } from "./types";

export type NavKey =
  | "dashboard"
  | "programs"
  | "categories"
  | "modules"
  | "blog"
  | "admissions"
  | "mentorship"
  | "community"
  | "notifications"
  | "users"
  | "profile"
  | "settings"
  | "help";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: string;
  label: string;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    icon: "solar:home-smile-bold",
    label: "Tableau de bord",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    key: "programs",
    href: "/dashboard/programs",
    icon: "solar:clipboard-list-bold",
    label: "Programmes",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    key: "categories",
    href: "/dashboard/categories",
    icon: "solar:tag-bold",
    label: "Catégories",
    roles: ["admin"],
  },
  {
    key: "modules",
    href: "/dashboard/modules",
    icon: "ph:stack-fill",
    label: "Modules",
    roles: ["admin", "program_creator"],
  },
  {
    key: "blog",
    href: "/dashboard/blog",
    icon: "solar:notebook-bold",
    label: "Blog",
    roles: ["admin", "program_creator"],
  },
  {
    key: "admissions",
    href: "/dashboard/admissions",
    icon: "solar:document-text-bold",
    label: "Candidatures",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    key: "mentorship",
    href: "/dashboard/mentorship",
    icon: "fluent:video-person-16-regular",
    label: "Mentorat",
    roles: ["admin", "mentor"],
  },
  {
    key: "community",
    href: "/dashboard/messaging",
    icon: "solar:users-group-two-rounded-bold",
    label: "Communauté",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    key: "notifications",
    href: "/dashboard/notifications",
    icon: "solar:bell-bold",
    label: "Notifications",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    key: "users",
    href: "/dashboard/users",
    icon: "solar:users-group-rounded-bold",
    label: "Utilisateurs",
    roles: ["admin"],
  },
];

export const SETTING_ITEMS: NavItem[] = [
  {
    key: "settings",
    href: "/dashboard/settings",
    icon: "solar:settings-bold",
    label: "Paramètres",
    roles: ["admin", "program_creator", "mentor"],
  },
];

export function navForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function settingsForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  return SETTING_ITEMS.filter((item) => item.roles.includes(role));
}
