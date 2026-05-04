export type UserRole = "admin" | "program_creator" | "mentor" | "student";

export type User = {
  id: number;
  email: string;
  username?: string | null;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  country?: string | null;
  phone_number?: string | null;
  notify_email_modules?: boolean;
  notify_email_quiz_deadlines?: boolean;
  notify_email_live_sessions?: boolean;
  notify_push_important_updates?: boolean;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};

export type ProgramSummary = {
  id: number;
  title: string;
  description: string;
  tag: string;
  length_in_weeks: number;
  start_date: string;
  end_date: string;
  price: string;
  currency?: "USD" | "EUR" | "XOF";
  cover_url?: string | null;
  validation_status?: "pending" | "approved" | "rejected";
  validation_comment?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: number | null;
  modules?: { id: number; title?: string }[];
};

export type ApplicationList = {
  id: number;
  program: string | Record<string, unknown>;
  applied_at?: string;
  motivation?: string;
  status?: string;
  student?: User;
  created_at?: string;
};

export type SessionRow = {
  id: number;
  title?: string;
  starts_at?: string;
  ends_at?: string;
  program?: number | null;
  [key: string]: unknown;
};

export type NotificationRow = {
  id: number;
  title: string;
  message: string;
  is_read?: boolean;
  created_at?: string;
  type?: string;
};

export type ConversationRow = {
  id: number;
  title?: string;
  updated_at?: string;
  [key: string]: unknown;
};
