import { apiFetch, unwrapArray } from "@/lib/api";

export { uploadFile, type UploadedFile } from "./uploadService";

export type BlogPostStatus = "draft" | "published";

export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_image_url?: string | null;
  author_name: string;
  author?: number | null;
  author_display_name?: string;
  status: BlogPostStatus;
  published_at?: string | null;
  featured: boolean;
  tags: string[];
  meta_title?: string;
  meta_description?: string;
  reading_time_minutes?: number;
  created_at?: string;
  updated_at?: string;
};

export type BlogPostWritePayload = {
  title?: string;
  slug?: string;
  excerpt?: string;
  body?: string;
  cover_image_url?: string | null;
  author_display_name?: string;
  status?: BlogPostStatus;
  published_at?: string | null;
  featured?: boolean;
  /** Tags séparés par des virgules côté API */
  tags?: string;
  meta_title?: string;
  meta_description?: string;
};

export async function listBlogPosts(init?: {
  signal?: AbortSignal;
}): Promise<BlogPost[]> {
  const data = await apiFetch<unknown>("/blog/posts/", {
    signal: init?.signal,
  });
  return unwrapArray<BlogPost>(data);
}

export async function getBlogPost(id: number | string): Promise<BlogPost> {
  return apiFetch<BlogPost>(
    `/blog/posts/${encodeURIComponent(String(id))}/`,
  );
}

export async function createBlogPost(
  payload: BlogPostWritePayload,
): Promise<BlogPost> {
  return apiFetch<BlogPost>("/blog/posts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBlogPost(
  id: number | string,
  payload: BlogPostWritePayload,
): Promise<BlogPost> {
  return apiFetch<BlogPost>(
    `/blog/posts/${encodeURIComponent(String(id))}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteBlogPost(id: number | string): Promise<void> {
  await apiFetch(`/blog/posts/${encodeURIComponent(String(id))}/`, {
    method: "DELETE",
  });
}

export function blogPostIsEditableBy(
  post: BlogPost,
  user: { id?: number; role?: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "program_creator" && user.id != null) {
    return post.author === user.id;
  }
  return false;
}

export function tagsToString(tags: string[] | undefined): string {
  if (!tags?.length) return "";
  return tags.join(", ");
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}
