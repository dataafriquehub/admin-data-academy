import { apiFetch, unwrapArray } from "@/lib/api";

export type ModuleContentType = "VIDEO" | "TEXT" | "QUIZ" | "ASSIGNMENT";
export type QuestionType = "single" | "multiple";

export type ModuleContent = {
  id?: number;
  title: string;
  description: string;
  type: ModuleContentType;
  order?: number;
  url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Answer = {
  id?: number;
  content: string;
  is_correct?: boolean;
};

export type Question = {
  id?: number;
  content: string;
  type?: QuestionType;
  points?: number;
  order?: number;
  answers?: Answer[];
};

export type Quiz = {
  id?: number;
  title: string;
  description?: string;
  min_score_rate?: number;
  questions?: Question[];
};

export type ModuleSummary = {
  id: number;
  title?: string;
  description?: string;
  objectives?: string;
  cover_url?: string | null;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  contents?: ModuleContent[];
  quizzes?: Quiz[];
};

export type ModuleDetail = ModuleSummary;

export type ModulePayload = {
  title: string;
  description: string;
  objectives: string;
  cover_url?: string | null;
  cover_image_base64?: string;
  contents?: ModuleContent[];
  quizzes?: Quiz[];
};

export async function listModules(init?: {
  signal?: AbortSignal;
}): Promise<ModuleSummary[]> {
  const data = await apiFetch<unknown>("/programs/modules/", {
    signal: init?.signal,
  });
  return unwrapArray<ModuleSummary>(data);
}

export async function getModule(id: number | string): Promise<ModuleDetail> {
  return apiFetch<ModuleDetail>(
    `/programs/modules/${encodeURIComponent(String(id))}/`,
  );
}

export async function createModule(
  payload: ModulePayload,
): Promise<ModuleDetail> {
  return apiFetch<ModuleDetail>("/programs/modules/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateModule(
  id: number | string,
  payload: Partial<ModulePayload>,
): Promise<ModuleDetail> {
  return apiFetch<ModuleDetail>(
    `/programs/modules/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteModule(id: number | string): Promise<void> {
  await apiFetch(`/programs/modules/${encodeURIComponent(String(id))}/`, {
    method: "DELETE",
  });
}

/**
 * Convertit un fichier image en base64 brut (sans préfixe `data:`).
 * Le serializer accepte aussi le data URL complet, mais on standardise sur
 * le format brut pour limiter les surprises côté backend.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Lecture du fichier image impossible."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Format de lecture inattendu."));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
