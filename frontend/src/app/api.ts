export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
  : "";

export function apiUrl(path: string) {
  return API_BASE_URL ? API_BASE_URL + path : path;
}

export async function readApi<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { error: text }; }
  }
  if (!response.ok) {
    const error = payload as { error?: unknown } | null;
    throw new Error(typeof error?.error === "string" ? error.error : `Request failed (${response.status})`);
  }
  return payload as T;
}

export function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
