import { apiFetch, unwrapArray } from "@/lib/api";
import type { User } from "@/lib/types";

export type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected";

export type FundingType = "pay_now" | "scholarship_request";

export type PaymentStatus =
  | "not_applicable"
  | "pending"
  | "paid"
  | "failed"
  | "waived";

export type ApplicationRow = {
  id: number;
  created_at?: string;
  student?: User | null;
  program?: string | { id?: number; title?: string; [key: string]: unknown };
  applied_at?: string;
  motivation?: string;
  current_profession?: string;
  employment_history?: unknown;
  funding_type?: FundingType | string;
  scholarship_justification?: string;
  payment_status?: PaymentStatus | string;
  payment_provider_ref?: string;
  payment_receipt_url?: string;
  status?: ApplicationStatus;
  review_at?: string | null;
  approved_at?: string | null;
  reviewed_by?: User | null;
};

export type ApplicationFilters = {
  status?: ApplicationStatus | "all";
  program?: number | "all";
  student?: number | "";
  reviewed_by?: number | "";
  search?: string;
  ordering?: string;
};

export type ApplicationProgressResponse = {
  summary?: {
    total_modules?: number;
    completed_modules?: number;
    in_progress_modules?: number;
    total_weeks?: number;
    elapsed_weeks?: number;
    progress_percent?: number;
    overall_status?: string;
  };
  modules?: Array<{
    id?: number;
    module_id?: number;
    title?: string;
    status?: string;
    progress_percent?: number;
    completed?: boolean;
    quizzes?: Array<{
      quiz_id?: number;
      title?: string;
      passed?: boolean;
      best_score_percent?: number | null;
      attempts_count?: number;
    }>;
  }>;
  [key: string]: unknown;
};

function buildQuery(filters: ApplicationFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.program && filters.program !== "all") {
    params.set("program", String(filters.program));
  }
  if (filters.student !== undefined && filters.student !== "") {
    params.set("student", String(filters.student));
  }
  if (filters.reviewed_by !== undefined && filters.reviewed_by !== "") {
    params.set("reviewed_by", String(filters.reviewed_by));
  }
  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.ordering?.trim()) {
    params.set("ordering", filters.ordering.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listApplications(
  filters: ApplicationFilters = {},
  init?: { signal?: AbortSignal },
): Promise<ApplicationRow[]> {
  const data = await apiFetch<unknown>(
    `/admissions/applications/${buildQuery(filters)}`,
    { signal: init?.signal },
  );
  return unwrapArray<ApplicationRow>(data);
}

export async function reviewApplication(
  id: number | string,
  status: ApplicationStatus,
): Promise<ApplicationRow> {
  return apiFetch<ApplicationRow>(
    `/admissions/applications/review/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function getApplicationProgress(
  id: number | string,
  init?: { signal?: AbortSignal },
): Promise<ApplicationProgressResponse> {
  return apiFetch<ApplicationProgressResponse>(
    `/admissions/applications/${encodeURIComponent(String(id))}/progress/`,
    { signal: init?.signal },
  );
}
