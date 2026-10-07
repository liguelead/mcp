import { config, LIGUELEAD_BASE_URL } from "../config.js";

export interface ApiResponse {
  status: number;
  body: unknown;
  headers: Headers;
  method: string;
  path: string;
  /** Set when the request never got an HTTP response (DNS, TLS, timeout...) */
  networkError?: string;
}

function authHeaders(): Record<string, string> {
  return {
    "api-token": config.LIGUELEAD_API_TOKEN,
    "app-id": config.LIGUELEAD_APP_ID,
  };
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send(
  method: string,
  path: string,
  init: RequestInit,
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${LIGUELEAD_BASE_URL}${path}`, { method, ...init });
    return { status: res.status, body: await readBody(res), headers: res.headers, method, path };
  } catch (error) {
    const e = error as { message?: string; cause?: { code?: string; message?: string } };
    const detail = [e?.cause?.code, e?.cause?.message ?? e?.message].filter(Boolean).join(" ");
    return { status: 0, body: {}, headers: new Headers(), method, path, networkError: detail || String(error) };
  }
}

/**
 * JSON request to LigueLead API (all endpoints except file upload).
 */
export async function apiRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse> {
  const headers = authHeaders();
  if (body) headers["Content-Type"] = "application/json";
  return send(method, path, { headers, body: body ? JSON.stringify(body) : undefined });
}

/**
 * Multipart upload to LigueLead API (voice audio).
 */
export async function apiUpload(path: string, formData: FormData): Promise<ApiResponse> {
  // Content-Type is set automatically by fetch for FormData
  return send("POST", path, { headers: authHeaders(), body: formData });
}

// ── Error reporting ────────────────────────────────────────────────

/** Turns the API's { error: string | [{ field, message }] } (or text/HTML) into one line */
export function describeBody(body: unknown): string | undefined {
  if (typeof body === "string") {
    const text = /<[a-z!/][\s\S]*>/i.test(body)
      ? body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      : body;
    return text.replace(/\s+/g, " ").trim().slice(0, 1000) || undefined;
  }
  if (!body || typeof body !== "object") return undefined;
  const data = body as { error?: unknown; errors?: unknown; message?: unknown; detail?: unknown };
  const err = data.error ?? data.errors ?? data.detail;
  if (typeof err === "string") return err;
  if (Array.isArray(err) && err.length) {
    return err
      .map((item: { field?: string; message?: string } | string) =>
        typeof item === "string"
          ? item
          : item?.field
            ? `${item.field}: ${item.message}`
            : String(item?.message ?? JSON.stringify(item)),
      )
      .join("; ");
  }
  if (err && typeof err === "object") return describeBody(err);
  if (typeof data.message === "string") return data.message;
  return undefined;
}

/**
 * Seen in LigueLead's logs: POST /rcs validates the agent on an internal service
 * (internal/rcs/agents/{client}/{agent}) that answers 429, surfaced as this generic
 * text. It fails before the send is queued, so retrying it does not duplicate sends.
 */
export function isInternalAgentThrottle(res: ApiResponse): boolean {
  return (
    res.status === 429 &&
    res.method === "POST" &&
    res.path === "/rcs" &&
    /failed to call ligueapi-backend/i.test(describeBody(res.body) ?? "")
  );
}

function explainStatus(res: ApiResponse): string {
  const s = res.status;
  if (isInternalAgentThrottle(res))
    return (
      "LigueLead validates the RCS agent on an internal service on every send, and that service hit its own rate limit. " +
      "This is not the account's limit and this send was NOT queued. Retry later (retry_when_busy=true does it automatically), " +
      "space out consecutive send_rcs calls, or put all recipients of the same message in one call (up to 10,000 phones)."
    );
  if (s === 400) return "Malformed request. Check the arguments.";
  if (s === 401)
    return "Credentials refused: LIGUELEAD_API_TOKEN or LIGUELEAD_APP_ID is wrong, expired or blocked (Integrations → API Token in the LigueLead panel).";
  if (s === 402) return "Not enough balance/credits for this send.";
  if (s === 403) return "These credentials are not allowed to use this resource (product not enabled, or resource owned by another App ID).";
  if (s === 404) return "The resource does not exist for these credentials (wrong audio/template/agent ID, or it belongs to another App ID).";
  if (s === 408 || s === 504) return "LigueLead timed out. Retry; if it persists, send the support data below to LigueLead.";
  if (s === 413) return "Payload too large (e.g. audio file above the limit).";
  if (s === 422) return "LigueLead rejected the data. The reason above says which field or rule failed.";
  if (s === 429)
    return "Rate limited by LigueLead (or its gateway could not serve the call). Space out calls, group phones in one request, avoid parallel bursts with the same credentials.";
  if (s >= 500) return "LigueLead internal error or instability — not a problem with the arguments. Retry; if it persists, contact LigueLead support.";
  return "LigueLead rejected the request.";
}

function header(res: ApiResponse, name: string): string | undefined {
  return res.headers.get(name) ?? undefined;
}

/** MCP tool result: the API body on success, an actionable explanation on failure */
export function toToolResult(res: ApiResponse, extra?: string) {
  if (res.networkError) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            `❌ Could not reach LigueLead (${res.method} ${res.path}): ${res.networkError}\n` +
            `No HTTP response was received (network, DNS, TLS or timeout). Base URL: ${LIGUELEAD_BASE_URL}`,
        },
      ],
      isError: true,
    };
  }
  if (res.status < 400) {
    const text = JSON.stringify(res.body, null, 2) + (extra ? `\n\n${extra}` : "");
    return { content: [{ type: "text" as const, text }], isError: false };
  }

  const reason = describeBody(res.body) ?? "no body in the response";
  const limits = ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]
    .map((n) => [n, header(res, n)])
    .filter(([, v]) => v)
    .map(([n, v]) => `${n}: ${v}`);
  const ids = ["x-amzn-requestid", "x-amz-cf-id", "x-request-id"]
    .map((n) => [n, header(res, n)])
    .filter(([, v]) => v)
    .map(([n, v]) => `${n}: ${v}`);
  const text = [
    `❌ LigueLead refused the request (HTTP ${res.status}): ${reason}`,
    `Call: ${res.method} /v1${res.path}`,
    `Meaning: ${explainStatus(res)}`,
    limits.length ? `Rate-limit headers: ${limits.join(" | ")}` : "",
    `Support data: ${header(res, "date") ?? new Date().toUTCString()} | App ID ${config.LIGUELEAD_APP_ID}` +
      (ids.length ? ` | ${ids.join(" | ")}` : ""),
    extra ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  return { content: [{ type: "text" as const, text }], isError: true };
}
