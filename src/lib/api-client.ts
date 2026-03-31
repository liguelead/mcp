import { config, LIGUELEAD_BASE_URL } from "../config.js";

interface ApiResponse {
  status: number;
  body: unknown;
}

/**
 * JSON request to LigueLead API (all endpoints except file upload).
 */
export async function apiRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse> {
  const url = `${LIGUELEAD_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "api-token": config.LIGUELEAD_API_TOKEN,
    "app-id": config.LIGUELEAD_APP_ID,
  };

  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

/**
 * Multipart upload to LigueLead API (voice audio).
 */
export async function apiUpload(
  path: string,
  formData: FormData,
): Promise<ApiResponse> {
  const url = `${LIGUELEAD_BASE_URL}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-token": config.LIGUELEAD_API_TOKEN,
      "app-id": config.LIGUELEAD_APP_ID,
      // Content-Type set automatically by fetch for FormData
    },
    body: formData,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}
