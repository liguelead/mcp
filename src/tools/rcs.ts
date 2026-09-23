import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../lib/api-client.js";
import {
  PhonesArraySchema,
  RcsButtonSchema,
  TemplateVariablesSchema,
} from "../lib/validators.js";

function errorContent(text: string) {
  return {
    content: [{ type: "text" as const, text: `❌ ${text}` }],
    isError: true,
  };
}

function validateMedia(media_url?: string, media_file?: string): string | null {
  if (media_url && media_file) {
    return "media_url and media_file are mutually exclusive — provide only one.";
  }
  if (media_file) {
    const match = media_file.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) {
      return 'media_file must be a base64 data URI (e.g. "data:image/png;base64,...").';
    }
    if (Buffer.from(match[1], "base64").length > 5 * 1024 * 1024) {
      return "media_file exceeds the 5 MB decoded size limit.";
    }
  }
  return null;
}

function validateButtons(buttons: z.infer<typeof RcsButtonSchema>[]): string | null {
  for (const btn of buttons) {
    if (btn.type === "open_url" && !btn.url) {
      return `Button "${btn.title}" has type "open_url" but no url was provided.`;
    }
    if (btn.type === "dial_call" && !btn.phone_number) {
      return `Button "${btn.title}" has type "dial_call" but no phone_number was provided.`;
    }
  }
  return null;
}

export function registerRcsTools(server: McpServer): void {
  // ── list_rcs_agents ──────────────────────────────────────────────
  server.tool(
    "list_rcs_agents",
    "List every RCS agent (sender brand) registered for the authenticated client, " +
      "with its review status. Useful to look up agent_id values for send_rcs — " +
      'only agents with status "approved" can send.',
    {},
    async () => {
      const res = await apiRequest("GET", "/rcs/agents");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );

  // ── create_rcs_template_text ─────────────────────────────────────
  server.tool(
    "create_rcs_template_text",
    "Create a plain-text RCS template (no media, no interactive buttons). " +
      'Supports "{{N}}" variable placeholders in the body, overridable at send time.',
    {
      title: z
        .string()
        .min(1)
        .describe("Friendly name persisted in the template registry"),
      body: z
        .string()
        .min(1)
        .max(1600)
        .describe('Message content (max 1600 chars). Supports "{{N}}" placeholders'),
      default_variables: TemplateVariablesSchema.describe(
        'Fallback values for the "{{N}}" placeholders declared in body',
      ),
      fallback_message: z
        .string()
        .max(306)
        .optional()
        .describe("SMS fallback if RCS delivery fails (max 306 chars)"),
    },
    async ({ title, body, default_variables, fallback_message }) => {
      const payload: Record<string, unknown> = { title, body };
      if (default_variables) payload.default_variables = default_variables;
      if (fallback_message) payload.fallback_message = fallback_message;

      const res = await apiRequest("POST", "/rcs/templates/text", payload);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );

  // ── create_rcs_template_media ────────────────────────────────────
  server.tool(
    "create_rcs_template_media",
    "Create an RCS template with media (image or short video). " +
      "Provide exactly one of media_url or media_file.",
    {
      title: z
        .string()
        .min(1)
        .describe("Friendly name persisted in the template registry"),
      header: z
        .string()
        .min(1)
        .max(100)
        .describe("Header text shown above the media (max 100 chars)"),
      body: z
        .string()
        .min(1)
        .max(1600)
        .describe('Message content (max 1600 chars). Supports "{{N}}" placeholders'),
      media_url: z
        .string()
        .url()
        .optional()
        .describe("Public media URL (mutually exclusive with media_file)"),
      media_file: z
        .string()
        .optional()
        .describe(
          "Base64 data URI, max 5 MB decoded (mutually exclusive with media_url)",
        ),
      fallback_message: z
        .string()
        .max(306)
        .optional()
        .describe("SMS fallback if RCS delivery fails (max 306 chars)"),
      default_variables: TemplateVariablesSchema.describe(
        'Fallback values for the "{{N}}" placeholders declared in body',
      ),
    },
    async ({
      title,
      header,
      body,
      media_url,
      media_file,
      fallback_message,
      default_variables,
    }) => {
      if (!media_url && !media_file) {
        return errorContent("Provide either media_url or media_file.");
      }
      const mediaError = validateMedia(media_url, media_file);
      if (mediaError) return errorContent(mediaError);

      const payload: Record<string, unknown> = { title, header, body };
      if (media_url) payload.media_url = media_url;
      if (media_file) payload.media_file = media_file;
      if (fallback_message) payload.fallback_message = fallback_message;
      if (default_variables) payload.default_variables = default_variables;

      const res = await apiRequest("POST", "/rcs/templates/media", payload);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );

  // ── create_rcs_template_card ─────────────────────────────────────
  server.tool(
    "create_rcs_template_card",
    "Create a single rich card RCS template with optional media and 1-4 interactive " +
      'buttons ("reply", "open_url", "dial_call").',
    {
      title: z
        .string()
        .min(1)
        .describe("Friendly name persisted in the template registry"),
      header: z.string().min(1).max(100).describe("Card header text (max 100 chars)"),
      body: z
        .string()
        .min(1)
        .max(1600)
        .describe('Card body content (max 1600 chars). Supports "{{N}}" placeholders'),
      media_url: z
        .string()
        .url()
        .optional()
        .describe("Public media URL (mutually exclusive with media_file)"),
      media_file: z
        .string()
        .optional()
        .describe(
          "Base64 data URI, max 5 MB decoded (mutually exclusive with media_url)",
        ),
      fallback_message: z
        .string()
        .max(306)
        .optional()
        .describe("SMS fallback if RCS delivery fails (max 306 chars)"),
      default_variables: TemplateVariablesSchema.describe(
        'Fallback values for the "{{N}}" placeholders declared in body',
      ),
      buttons: z
        .array(RcsButtonSchema)
        .min(1)
        .max(4)
        .describe("1 to 4 interactive buttons"),
    },
    async ({
      title,
      header,
      body,
      media_url,
      media_file,
      fallback_message,
      default_variables,
      buttons,
    }) => {
      const mediaError = validateMedia(media_url, media_file);
      if (mediaError) return errorContent(mediaError);

      const buttonError = validateButtons(buttons);
      if (buttonError) return errorContent(buttonError);

      const payload: Record<string, unknown> = { title, header, body, buttons };
      if (media_url) payload.media_url = media_url;
      if (media_file) payload.media_file = media_file;
      if (fallback_message) payload.fallback_message = fallback_message;
      if (default_variables) payload.default_variables = default_variables;

      const res = await apiRequest("POST", "/rcs/templates/card", payload);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );

  // ── create_rcs_template_carousel ─────────────────────────────────
  server.tool(
    "create_rcs_template_carousel",
    "Create a horizontal carousel RCS template with 2-10 rich cards. All cards must " +
      "declare the same number of buttons, in the same type/order (0-2 buttons per card).",
    {
      title: z
        .string()
        .min(1)
        .describe("Friendly name persisted in the template registry"),
      fallback_message: z
        .string()
        .max(306)
        .optional()
        .describe("SMS fallback if RCS delivery fails (max 306 chars)"),
      default_variables: TemplateVariablesSchema.describe(
        'Fallback values for the "{{N}}" placeholders declared across the cards',
      ),
      cards: z
        .array(
          z.object({
            header: z.string().min(1).max(100).describe("Card header (max 100 chars)"),
            body: z
              .string()
              .min(1)
              .max(1600)
              .describe('Card body (max 1600 chars). Supports "{{N}}" placeholders'),
            media_url: z
              .string()
              .url()
              .optional()
              .describe("Public media URL (mutually exclusive with media_file)"),
            media_file: z
              .string()
              .optional()
              .describe(
                "Base64 data URI, max 5 MB decoded (mutually exclusive with media_url)",
              ),
            buttons: z
              .array(RcsButtonSchema)
              .max(2)
              .optional()
              .describe("0 to 2 interactive buttons"),
          }),
        )
        .min(2)
        .max(10)
        .describe("2 to 10 cards rendered horizontally"),
    },
    async ({ title, fallback_message, default_variables, cards }) => {
      for (const card of cards) {
        const mediaError = validateMedia(card.media_url, card.media_file);
        if (mediaError) return errorContent(mediaError);
        if (card.buttons) {
          const buttonError = validateButtons(card.buttons);
          if (buttonError) return errorContent(buttonError);
        }
      }

      const buttonCounts = new Set(cards.map((c) => c.buttons?.length ?? 0));
      if (buttonCounts.size > 1) {
        return errorContent("All cards must declare the same number of buttons.");
      }
      const signature = (c: (typeof cards)[number]) =>
        (c.buttons ?? []).map((b) => b.type).join(",");
      if (new Set(cards.map(signature)).size > 1) {
        return errorContent("All cards must declare buttons in the same type/order.");
      }

      const payload: Record<string, unknown> = { title, cards };
      if (fallback_message) payload.fallback_message = fallback_message;
      if (default_variables) payload.default_variables = default_variables;

      const res = await apiRequest("POST", "/rcs/templates/carousel", payload);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );

  // ── send_rcs ──────────────────────────────────────────────────────
  server.tool(
    "send_rcs",
    "Send an RCS campaign to a list of phones. Either template_id (with optional " +
      "template_variables overrides) or a freeform message (max 306 chars, also reused " +
      "as the SMS fallback) — the two are mutually exclusive. " +
      "Async operation — returns 202 when queued.",
    {
      phones: PhonesArraySchema.describe(
        "Array of Brazilian phone numbers (max 10,000)",
      ),
      agent_id: z
        .string()
        .uuid()
        .describe(
          "ID of the approved RCS agent (sender brand shown on the device). " +
            "Required on every send — use list_rcs_agents to find it",
        ),
      template_id: z
        .string()
        .optional()
        .describe(
          "Template ID from a previously created RCS template. Mutually exclusive with message",
        ),
      template_variables: TemplateVariablesSchema.describe(
        "Override values for the placeholders declared on the template's default_variables",
      ),
      message: z
        .string()
        .max(306)
        .optional()
        .describe(
          "Freeform message for template-less sends (max 306 chars, reused as SMS fallback). " +
            "Mutually exclusive with template_id",
        ),
    },
    async ({ phones, agent_id, template_id, template_variables, message }) => {
      if (template_id && message) {
        return errorContent(
          "template_id and message are mutually exclusive — provide only one.",
        );
      }
      if (!template_id && !message) {
        return errorContent("Provide either template_id or message.");
      }

      const payload: Record<string, unknown> = { phones, agent_id };
      if (template_id) payload.template_id = template_id;
      if (template_variables) payload.template_variables = template_variables;
      if (message) payload.message = message;

      const res = await apiRequest("POST", "/rcs", payload);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(res.body, null, 2) },
        ],
        isError: res.status >= 400,
      };
    },
  );
}
