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
