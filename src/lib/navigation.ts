import type { UserRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: "solar:widget-5-bold-duotone",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    href: "/dashboard/programs",
    label: "Programmes",
    icon: "solar:diploma-bold-duotone",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    href: "/dashboard/modules",
    label: "Modules",
    icon: "solar:book-bookmark-bold-duotone",
    roles: ["admin", "program_creator"],
  },
  {
    href: "/dashboard/admissions",
    label: "Candidatures",
    icon: "solar:clipboard-list-bold-duotone",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    href: "/dashboard/mentorship",
    label: "Mentorat",
    icon: "solar:users-group-rounded-bold-duotone",
    roles: ["admin", "mentor"],
  },
  {
    href: "/dashboard/messaging",
    label: "Messagerie",
    icon: "solar:chat-round-dots-bold-duotone",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: "solar:bell-bold-duotone",
    roles: ["admin", "program_creator", "mentor"],
  },
  {
    href: "/dashboard/users",
    label: "Utilisateurs",
    icon: "solar:user-id-bold-duotone",
    roles: ["admin"],
  },
  {
    href: "/dashboard/settings",
    label: "Paramètres",
    icon: "solar:settings-bold-duotone",
    roles: ["admin", "program_creator", "mentor"],
  },
];

export function navForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
