import { apiFetch, unwrapArray } from "@/lib/api";

export type Category = {
  id: number;
  slug: string;
  label: string;
  description?: string | null;
  icon: string;
  color?: string | null;
  order?: number;
  is_active?: boolean;
  program_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type CategoryWritePayload = {
  slug?: string;
  label?: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  is_active?: boolean;
};

export function slugifyLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCategories(init?: {
  signal?: AbortSignal;
  /** Par défaut true — pour le formulaire programme. */
  activeOnly?: boolean;
}): Promise<Category[]> {
  const data = await apiFetch<unknown>("/programs/categories/", {
    signal: init?.signal,
  });
  const list = unwrapArray<Category>(data);
  if (init?.activeOnly === false) return list;
  return list.filter((c) => c.is_active !== false);
}

export async function getCategory(id: number | string): Promise<Category> {
  return apiFetch<Category>(
    `/programs/categories/${encodeURIComponent(String(id))}/`,
  );
}

export async function createCategory(
  payload: CategoryWritePayload,
): Promise<Category> {
  return apiFetch<Category>("/programs/categories/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: number | string,
  payload: CategoryWritePayload,
): Promise<Category> {
  return apiFetch<Category>(
    `/programs/categories/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteCategory(id: number | string): Promise<void> {
  await apiFetch(`/programs/categories/${encodeURIComponent(String(id))}/`, {
    method: "DELETE",
  });
}
