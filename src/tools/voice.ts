import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, apiUpload, toToolResult } from "../lib/api-client.js";
import { PhonesArraySchema, WebhookUrlSchema } from "../lib/validators.js";

/** Same window rules as the API, checked up front so the reason is explicit */
function checkRetryEndTime(time: string): string | undefined {
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  if (minutes < 8 * 60 || minutes > 21 * 60 + 45) {
    return `retry_end_time ${time} is outside the allowed window 08:00-21:45 (America/Sao_Paulo).`;
  }
  const [nowH, nowM] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .split(":")
    .map(Number);
  const nowMinutes = nowH * 60 + nowM;
  if (minutes < nowMinutes + 10) {
    const earliest = nowMinutes + 10;
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `retry_end_time ${time} must be at least 10 minutes from now ` +
      `(now ${pad(nowH)}:${pad(nowM)} in Sao Paulo; earliest ${pad(Math.floor(earliest / 60))}:${pad(earliest % 60)}).`
    );
  }
  return undefined;
}

export function registerVoiceTools(server: McpServer): void {
  // ── list_voice_uploads ───────────────────────────────────────────
  server.tool(
    "list_voice_uploads",
    "List all previously uploaded voice audio files.",
    {},
    async () => {
      const res = await apiRequest("GET", "/voice/uploads");
      return toToolResult(res);
    },
  );

  // ── get_voice_upload ─────────────────────────────────────────────
  server.tool(
    "get_voice_upload",
    "Get details of a specific voice audio upload by ID.",
    {
      id: z.number().int().positive().describe("Voice upload ID"),
    },
    async ({ id }) => {
      const res = await apiRequest("GET", `/voice/uploads/${id}`);
      return toToolResult(res);
    },
  );

  // ── upload_voice_audio ───────────────────────────────────────────
  server.tool(
    "upload_voice_audio",
    "Upload an audio file for voice campaigns. Accepts MP3 or WAV (max 50 MB). " +
      "Returns a voice_upload_id to use with send_voice_message.",
    {
      title: z.string().min(1).describe("Title for the audio upload"),
      file_base64: z
        .string()
        .min(1)
        .describe("Base64-encoded audio file content"),
      filename: z
        .string()
        .min(1)
        .describe('Original filename with extension (e.g. "audio.mp3")'),
    },
    async ({ title, file_base64, filename }) => {
      const ext = filename.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
      };
      const mimeType = ext ? mimeMap[ext] : undefined;

      if (!mimeType) {
        return {
          content: [
            {
              type: "text" as const,
              text: "❌ Only MP3 and WAV files are supported. AAC and M4A are rejected by the API.",
            },
          ],
          isError: true,
        };
      }

      const buffer = Buffer.from(file_base64, "base64");

      if (buffer.length > 50 * 1024 * 1024) {
        return {
          content: [
            {
              type: "text" as const,
              text: "❌ File exceeds 50 MB limit.",
            },
          ],
          isError: true,
        };
      }

      const blob = new globalThis.Blob([buffer], { type: mimeType });
      const formData = new FormData();
      formData.append("title", title);
      formData.append("file", blob, filename);

      const res = await apiUpload("/voice/uploads", formData);

      return toToolResult(res);
    },
  );

  // ── send_voice_message ───────────────────────────────────────────
  server.tool(
    "send_voice_message",
    "Send a voice campaign to a list of phones. Requires a voice_upload_id from a previous upload. " +
      "Dialing window: 08:00–21:44 (America/Sao_Paulo). Requests after 21:45 are queued until 08:00.",
    {
      title: z.string().min(1).describe("Campaign title (required)"),
      voice_upload_id: z
        .number()
        .int()
        .positive()
        .describe("ID of the previously uploaded audio"),
      phones: PhonesArraySchema.describe(
        "Array of Brazilian phone numbers (max 10,000)",
      ),
      group_id: z
        .string()
        .optional()
        .describe("Contact group ID (optional)"),
      retry_attempts: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe("Retry attempts after a failed call (1-3, API default 3)"),
      retry_interval_min: z
        .number()
        .int()
        .min(5)
        .max(180)
        .optional()
        .describe("Minutes between retry attempts (5-180, API default 15)"),
      retry_end_time: z
        .string()
        .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "retry_end_time must be HH:MM (e.g. 09:30)")
        .optional()
        .describe(
          "Cutoff time for retries, HH:MM in America/Sao_Paulo. Must be 08:00-21:45 and at least 10 minutes from now",
        ),
      webhook_url: WebhookUrlSchema,
    },
    async ({
      title,
      voice_upload_id,
      phones,
      group_id,
      retry_attempts,
      retry_interval_min,
      retry_end_time,
      webhook_url,
    }) => {
      if (retry_end_time) {
        const problem = checkRetryEndTime(retry_end_time);
        if (problem) {
          return { content: [{ type: "text" as const, text: `❌ ${problem}` }], isError: true };
        }
      }

      const body: Record<string, unknown> = { title, voice_upload_id, phones };
      if (group_id) body.group_id = group_id;
      if (retry_attempts !== undefined) body.retry_attempts = retry_attempts;
      if (retry_interval_min !== undefined) body.retry_interval_min = retry_interval_min;
      if (retry_end_time) body.retry_end_time = retry_end_time;
      if (webhook_url) body.webhook_url = webhook_url;

      const res = await apiRequest("POST", "/voice", body);

      return toToolResult(res);
    },
  );
}
