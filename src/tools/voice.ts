import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, apiUpload } from "../lib/api-client.js";
import { PhonesArraySchema } from "../lib/validators.js";

export function registerVoiceTools(server: McpServer): void {
  // ── list_voice_uploads ───────────────────────────────────────────
  server.tool(
    "list_voice_uploads",
    "List all previously uploaded voice audio files.",
    {},
    async () => {
      const res = await apiRequest("GET", "/voice/uploads");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
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
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
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

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
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
    },
    async ({ title, voice_upload_id, phones, group_id }) => {
      const body: Record<string, unknown> = { title, voice_upload_id, phones };
      if (group_id) body.group_id = group_id;

      const res = await apiRequest("POST", "/voice", body);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );
}
