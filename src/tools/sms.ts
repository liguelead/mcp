import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../lib/api-client.js";
import { PhonesArraySchema } from "../lib/validators.js";

export function registerSmsTools(server: McpServer): void {
  server.tool(
    "send_sms",
    "Send an SMS or SMS Flash campaign via LigueLead. " +
      "Async operation — returns 202 when queued. " +
      "Flash SMS does NOT allow URLs in the message body. " +
      "Credits: up to 160 chars = 1 credit; each additional 152 chars = +1 credit; max ~11 credits (1600 chars).",
    {
      title: z
        .string()
        .optional()
        .describe("Campaign title / identifier (optional)"),
      message: z
        .string()
        .min(1)
        .max(1600)
        .describe("SMS content (max 1600 chars)"),
      phones: PhonesArraySchema.describe(
        "Array of Brazilian phone numbers (max 10,000)",
      ),
      group_id: z
        .string()
        .optional()
        .describe("Contact group ID (optional)"),
      is_flash: z
        .boolean()
        .default(false)
        .describe("true = Flash SMS (no URLs allowed), false = standard SMS"),
    },
    async ({ title, message, phones, group_id, is_flash }) => {
      // Flash SMS cannot contain URLs
      if (is_flash && /https?:\/\//i.test(message)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "❌ Flash SMS does not allow URLs in the message body. Remove all links and try again.",
            },
          ],
          isError: true,
        };
      }

      const body: Record<string, unknown> = { message, phones, is_flash };
      if (title) body.title = title;
      if (group_id) body.group_id = group_id;

      const res = await apiRequest("POST", "/sms", body);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(res.body, null, 2),
          },
        ],
        isError: res.status >= 400,
      };
    },
  );
}
