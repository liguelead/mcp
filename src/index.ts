#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { config } from "./config.js";
import { registerWebhookEndpoint } from "./lib/webhook.js";
import { registerSmsTools } from "./tools/sms.js";
import { registerVoiceTools } from "./tools/voice.js";
import { randomUUID } from "node:crypto";

// ── Create MCP server ──────────────────────────────────────────────
const server = new McpServer({
  name: "liguelead-mcp",
  version: "1.0.0",
  description:
    "MCP Server for LigueLead — SMS, SMS Flash & Voice campaigns (Brazil)",
});

registerSmsTools(server);
registerVoiceTools(server);

// ── Transport selection ────────────────────────────────────────────
if (config.TRANSPORT === "stdio") {
  // stdio transport — for Claude Desktop, Claude Code, local usage
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🟢 LigueLead MCP Server running (stdio)");
} else {
  // Streamable HTTP transport — for remote / hosted usage
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "liguelead-mcp", version: "1.0.0" });
  });

  // Webhook (ONLY handler — no duplicate registration)
  registerWebhookEndpoint(app);

  // MCP Streamable HTTP endpoint
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
    });

    transport.onclose = () => {
      const sid = [...transports.entries()].find(
        ([, t]) => t === transport,
      )?.[0];
      if (sid) transports.delete(sid);
    };

    const mcpServerInstance = new McpServer({
      name: "liguelead-mcp",
      version: "1.0.0",
      description:
        "MCP Server for LigueLead — SMS, SMS Flash & Voice campaigns (Brazil)",
    });
    registerSmsTools(mcpServerInstance);
    registerVoiceTools(mcpServerInstance);

    await mcpServerInstance.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "Missing or invalid mcp-session-id header" });
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(400).json({ error: "Missing or invalid mcp-session-id header" });
  });

  app.listen(config.PORT, () => {
    console.log(`🟢 LigueLead MCP Server running on http://localhost:${config.PORT}`);
    console.log(`   MCP endpoint:  POST /mcp`);
    console.log(`   Webhook:       POST /webhook`);
    console.log(`   Webhooks log:  GET  /webhooks`);
    console.log(`   Health:        GET  /health`);
  });
}
