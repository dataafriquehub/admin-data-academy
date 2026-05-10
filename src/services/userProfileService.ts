import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

/**
 * Champs autorisés en écriture par `CurrentUserUpdateSerializer`. Le serializer
 * rejette silencieusement tout autre champ (email, role, mots de passe…).
 */
export type CurrentUserUpdate = {
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string | null;
  country?: string | null;
  phone_number?: string | null;
  notify_email_modules?: boolean;
  notify_email_quiz_deadlines?: boolean;
  notify_email_live_sessions?: boolean;
  notify_push_important_updates?: boolean;
};

export type ChangePasswordPayload = {
  old_password: string;
  new_password: string;
  confirm_password: string;
};

export async function fetchCurrentUser(): Promise<User> {
  return apiFetch<User>("/users/auth/me/");
}

export async function updateCurrentUser(
  payload: CurrentUserUpdate,
): Promise<User> {
  return apiFetch<User>("/users/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<{ message?: string }> {
  return apiFetch<{ message?: string }>("/users/auth/password/change/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
