import { z } from "zod";

/**
 * Brazilian phone — three accepted formats:
 *  - Nacional (11 digits):          11999999999
 *  - Internacional (+ prefix, 14):  +5511999999999
 *  - DDI sem + (13 digits):         5511999999999
 */
export const BrazilianPhoneSchema = z
  .string()
  .regex(
    /^(\+55\d{10,11}|55\d{10,11}|\d{10,11})$/,
    "Invalid Brazilian phone. Accepted: 11999999999 | +5511999999999 | 5511999999999",
  );

export const PhonesArraySchema = z
  .array(BrazilianPhoneSchema)
  .min(1, "At least one phone number is required")
  .max(10_000, "Maximum 10,000 phones per request");

/**
 * Key-value pairs overriding/declaring "{{N}}" placeholders used across
 * RCS template creation (default_variables) and send_rcs (template_variables).
 */
export const TemplateVariablesSchema = z
  .array(
    z.object({
      key: z
        .string()
        .regex(
          /^\d+$/,
          'key must be a numeric string matching a "{{N}}" placeholder',
        ),
      value: z.string(),
    }),
  )
  .optional();

export const RcsButtonSchema = z.object({
  type: z
    .enum(["reply", "open_url", "dial_call"])
    .describe("Button action type"),
  title: z.string().min(1).max(25).describe("Button label (max 25 chars)"),
  url: z
    .string()
    .url()
    .optional()
    .describe('Required when type = "open_url"'),
  phone_number: z
    .string()
    .optional()
    .describe('Required (E.164 format) when type = "dial_call"'),
  postback_data: z
    .string()
    .max(2048)
    .optional()
    .describe('Echoed back on the webhook (type = "reply" only)'),
});

/**
 * Per-send status callback accepted by /sms, /voice and /rcs. Same rules as the API:
 * http/https, public hostname without underscores, max 512 chars, no private addresses.
 */
export const WebhookUrlSchema = z
  .string()
  .max(512, "webhook_url must be at most 512 characters")
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "webhook_url is not a valid URL" });
      return;
    }
    const host = url.hostname.toLowerCase();
    const problem =
      url.protocol !== "http:" && url.protocol !== "https:"
        ? "webhook_url must use http or https"
        : host.includes("_")
          ? "webhook_url hostname cannot contain underscores"
          : host === "localhost" ||
              host.endsWith(".local") ||
              host.endsWith(".internal") ||
              !host.includes(".") ||
              host.startsWith("[") ||
              /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
            ? "webhook_url cannot point to a private or reserved address"
            : undefined;
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  })
  .optional()
  .describe(
    "Optional URL that receives this send's status events (campaign.status) instead of the app's webhook URL. " +
      "Called exactly as written, query string included (e.g. ?order=123). Public http/https only, max 512 chars.",
  );
