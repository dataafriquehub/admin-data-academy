import { apiFetch, unwrapArray } from "@/lib/api";
import type { User } from "@/lib/types";
import type { ModuleSummary } from "./moduleService";

export { uploadFile, type UploadedFile } from "./uploadService";

export type ValidationStatus = "pending" | "approved" | "rejected";
export type Currency = "USD" | "EUR" | "XOF";

export type ProgramModuleEntry = {
  id?: number;
  program?: number;
  module?: number;
  module_details?: ModuleSummary | null;
  order: number;
  start_date?: string | null;
  end_date?: string | null;
  length_in_weeks?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type Program = {
  id: number;
  title: string;
  description: string;
  cover_url?: string | null;
  tag: string;
  length_in_weeks: number;
  start_date: string;
  end_date: string;
  price: string;
  currency?: Currency | null;
  validation_status?: ValidationStatus;
  validation_comment?: string | null;
  validated_at?: string | null;
  validated_by?: number | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  modules?: ProgramModuleEntry[];
  /** Présent uniquement quand l'API enrichit pour un admin (cf. brief §1.6). */
  creator?: User | null;
  /** Idem (utilisateur ayant validé). */
  validated_by_user?: User | null;
};

export type ProgramModuleWriteEntry = {
  module_id: number;
  order: number;
  start_date?: string | null;
  end_date?: string | null;
  length_in_weeks?: number;
};

export type ProgramWritePayload = {
  title?: string;
  description?: string;
  cover_url?: string | null;
  tag?: string;
  length_in_weeks?: number;
  start_date?: string;
  end_date?: string;
  price?: string;
  currency?: Currency;
  validation_status?: ValidationStatus;
  validation_comment?: string | null;
  /**
   * Mutuellement exclusif avec `module_ids` — ne jamais envoyer les deux dans
   * la même requête (validateur backend).
   */
  program_modules?: ProgramModuleWriteEntry[];
  module_ids?: number[];
};

export async function listPrograms(init?: {
  signal?: AbortSignal;
}): Promise<Program[]> {
  const data = await apiFetch<unknown>("/programs/programs/", {
    signal: init?.signal,
  });
  return unwrapArray<Program>(data);
}

export async function getProgram(id: number | string): Promise<Program> {
  return apiFetch<Program>(
    `/programs/programs/${encodeURIComponent(String(id))}/`,
  );
}

export async function createProgram(
  payload: ProgramWritePayload,
): Promise<Program> {
  return apiFetch<Program>("/programs/programs/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProgram(
  id: number | string,
  payload: ProgramWritePayload,
): Promise<Program> {
  return apiFetch<Program>(
    `/programs/programs/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteProgram(id: number | string): Promise<void> {
  await apiFetch(`/programs/programs/${encodeURIComponent(String(id))}/`, {
    method: "DELETE",
  });
}

export function programIsEditableBy(
  program: Program,
  user: { id?: number; role?: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "program_creator" && user.id != null) {
    return program.created_by === user.id;
  }
  return false;
}
