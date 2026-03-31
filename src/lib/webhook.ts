import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Express, Request, Response } from "express";

const WEBHOOKS_FILE = resolve(process.cwd(), "webhooks.json");

export interface WebhookEntry {
  received_at: string;
  event: string;
  app_id: string;
  occurred_at: string;
  campaign: Record<string, unknown>;
}

// ── Persistence helpers ────────────────────────────────────────────

function loadWebhooks(): WebhookEntry[] {
  if (!existsSync(WEBHOOKS_FILE)) return [];
  try {
    const raw = readFileSync(WEBHOOKS_FILE, "utf-8");
    return JSON.parse(raw) as WebhookEntry[];
  } catch {
    return [];
  }
}

function saveWebhook(entry: WebhookEntry): void {
  const webhooks = loadWebhooks();
  webhooks.push(entry);
  try {
    writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Failed to save webhook:", err);
  }
}

// ── Express route registration ─────────────────────────────────────

export function registerWebhookEndpoint(app: Express): void {
  // POST /webhook — receives status notifications from LigueLead
  app.post("/webhook", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;

    if (!body || body.event !== "campaign.status") {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const entry: WebhookEntry = {
      received_at: new Date().toISOString(),
      event: body.event as string,
      app_id: (body.app_id as string) ?? "",
      occurred_at: (body.occurred_at as string) ?? "",
      campaign: (body.campaign as Record<string, unknown>) ?? {},
    };

    saveWebhook(entry);

    console.log(
      `📩 Webhook received: campaign=${(entry.campaign.id as string) ?? "?"} ` +
        `type=${(entry.campaign.type as string) ?? "?"} ` +
        `status=${(entry.campaign.status as string) ?? "?"}`,
    );

    res.status(200).json({ received: true });
  });

  // GET /webhooks — query all persisted webhooks
  app.get("/webhooks", (_req: Request, res: Response) => {
    const webhooks = loadWebhooks();
    res.json({ total: webhooks.length, webhooks });
  });
}
