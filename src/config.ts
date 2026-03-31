import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// ── Native .env loader (no dotenv dependency) ──────────────────────
const envPath = resolve(process.cwd(), ".env");
try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on real environment variables
}

// ── Schema ─────────────────────────────────────────────────────────
const envSchema = z.object({
  LIGUELEAD_API_TOKEN: z.string().min(1, "LIGUELEAD_API_TOKEN is required"),
  LIGUELEAD_APP_ID: z.string().min(1, "LIGUELEAD_APP_ID is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  TRANSPORT: z.enum(["http", "stdio"]).default("http"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;

export const LIGUELEAD_BASE_URL = "https://api.liguelead.com.br/v1";
