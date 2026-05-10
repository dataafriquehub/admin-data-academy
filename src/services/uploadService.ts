import { getStoredAccessToken } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/config";

export type UploadedFile = {
  id: string;
  url: string;
  path?: string;
  file_name?: string;
  folder?: string;
  resource_type?: string;
  content_type?: string;
  size?: number;
};

/**
 * Upload multipart vers `POST /uploads/`. On utilise `fetch` direct car
 * `apiFetch` force `Content-Type: application/json` quand le body n'est pas
 * un FormData, et nous voulons laisser le navigateur générer la boundary.
 */
export async function uploadFile(
  file: File,
  options: { folder?: string; resourceType?: string } = {},
): Promise<UploadedFile> {
  const base = getApiBaseUrl();
  const token = getStoredAccessToken();
  const form = new FormData();
  form.append("file", file);
  if (options.folder) form.append("folder", options.folder);
  if (options.resourceType) form.append("resource_type", options.resourceType);

  const res = await fetch(`${base}/uploads/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    let message = `Échec de l'upload (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
      else if (typeof data?.error === "string") message = data.error;
      else message = JSON.stringify(data);
    } catch {
      /* on garde le message générique */
    }
    throw new Error(message);
  }
  return (await res.json()) as UploadedFile;
}
