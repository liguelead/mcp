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
