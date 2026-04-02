# 📱 LigueLead MCP Server

> MCP Server for sending **SMS**, **SMS Flash**, and **voice calls** in Brazil via the [LigueLead API](https://docs.liguelead.com.br).
> Enable **Claude**, **Cursor**, **Windsurf**, and any MCP-compatible AI agent to send real communications — no code, no complex setup.

🇧🇷 **Brazilian CPaaS** · BRL pricing · PIX payments · PT-BR support

[![npm version](https://img.shields.io/npm/v/@liguelead/mcp-server)](https://www.npmjs.com/package/@liguelead/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Available tools

| Tool | Description |
|------|------------|
| `send_sms` | Send SMS or SMS Flash campaign to Brazilian phone numbers |
| `list_voice_uploads` | List all uploaded voice audio files |
| `get_voice_upload` | Get details of a specific voice upload |
| `upload_voice_audio` | Upload MP3/WAV audio for voice campaigns |
| `send_voice_message` | Send a voice campaign to a list of phones |

## Quick start

### Option 1: npx (recommended)

No installation needed — just add to your MCP client config:

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "npx",
      "args": ["-y", "@liguelead/mcp-server"],
      "env": {
        "LIGUELEAD_API_TOKEN": "your-token",
        "LIGUELEAD_APP_ID": "your-app-id",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

### Option 2: Clone & build

```bash
git clone https://github.com/liguelead/mcp.git
cd mcp
npm install
cp .env.example .env  # Edit with your credentials
npm run build
npm start
```

The server starts at `http://localhost:3000` by default.

### Getting your credentials

1. Go to [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Navigate to **Integrações → API Token**
3. Create an App and copy the **API Token** and **App ID**

## Transports

| Transport | Use case | Env var |
|-----------|----------|---------|
| Streamable HTTP (default) | Remote server, any MCP client | `TRANSPORT=http` |
| stdio | Local — Claude Desktop / Claude Code / Cursor | `TRANSPORT=stdio` |

## Client configuration

### Claude Desktop (stdio)

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "npx",
      "args": ["-y", "@liguelead/mcp-server"],
      "env": {
        "LIGUELEAD_API_TOKEN": "your-token",
        "LIGUELEAD_APP_ID": "your-app-id",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add -s user liguelead \
  -e LIGUELEAD_API_TOKEN=your-token \
  -e LIGUELEAD_APP_ID=your-app-id \
  -e TRANSPORT=stdio \
  -- npx -y @liguelead/mcp-server
```

### Cursor / Windsurf

Add to your MCP settings with the same configuration as Claude Desktop above.

### Remote HTTP server

Any MCP client that supports Streamable HTTP can connect via:

```
POST https://your-server.com/mcp
```

Credentials stay on the server — the client doesn't need them.

### mcp-remote bridge

For clients that don't support HTTP natively (e.g., Claude Desktop connecting to a remote server):

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-server.com/mcp"]
    }
  }
}
```

## Deploy

### Docker

```bash
docker build -t liguelead-mcp .
docker run -d -p 3000:3000 \
  -e LIGUELEAD_API_TOKEN=your-token \
  -e LIGUELEAD_APP_ID=your-app-id \
  liguelead-mcp
```

### Railway / Render

1. Connect the Git repository
2. Set environment variables: `LIGUELEAD_API_TOKEN`, `LIGUELEAD_APP_ID`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

## Credential security

| Scenario | Where credentials live |
|----------|----------------------|
| stdio (local) | Environment variables in client config |
| HTTP (remote) | Environment variables on the server |
| Docker | `-e` flags or orchestrator secrets |
| CI/CD | Provider secrets (GitHub Actions, etc.) |

⚠️ Credentials are NEVER committed to code. The `.env` file is in `.gitignore`.

## Webhook

### Setup

1. Go to [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Navigate to **Integrações → API Token → Webhook URL**
3. Enter your public HTTPS endpoint URL
4. Save

A single URL receives notifications for all channels (SMS, SMS Flash, Voice).

### Query received webhooks

```bash
curl http://localhost:3000/webhooks
```

Returns:

```json
{
  "total": 42,
  "webhooks": [...]
}
```

⚠️ **CRITICAL:** LigueLead does NOT retry failed webhooks. If your endpoint is down, the webhook is lost permanently.

## Phone number format

Brazilian phone numbers are accepted in three formats:

| Format | Example | Digits |
|--------|---------|--------|
| National (recommended) | `11999999999` | 11 |
| International | `+5511999999999` | 14 chars |
| DDI without `+` | `5511999999999` | 13 |

## SMS limits

| Part | Characters | Credits |
|------|-----------|---------|
| 1st part | up to 160 | 1 credit |
| Additional parts | every 152 chars | 1 credit each |
| Maximum total | 1,600 chars | ~11 credits |

🚫 **SMS Flash does NOT allow URLs** in message content.

## Voice call limits

- **Supported formats:** MP3 and WAV (no AAC/M4A)
- **Max file size:** 50 MB (recommended: 5–10 MB)
- **Billing:** Up to 30s = 1 credit; over 30s = 2 credits
- **Dialing window:** 08:00–21:44 (America/Sao_Paulo). Requests after 21:45 are queued until 08:00.

## Rate limits

| Limit | Value |
|-------|-------|
| Requests per minute | 600,000 |
| Simultaneous requests | 10,000 |
| Recipients per request | 10,000 |

## Project structure

```
liguelead-mcp/
├── src/
│   ├── index.ts          # Entry point — HTTP or stdio
│   ├── config.ts          # Env var validation (Zod) + .env loader
│   ├── lib/
│   │   ├── api-client.ts  # HTTP client for LigueLead API
│   │   ├── validators.ts  # Brazilian phone schemas (Zod)
│   │   └── webhook.ts     # Webhook handler + GET /webhooks
│   └── tools/
│       ├── sms.ts         # Tool: send_sms
│       └── voice.ts       # Tools: voice (list/get/upload/send)
├── skill/                  # Claude Code Skill
│   └── SKILL.md
├── .env.example
├── Dockerfile
├── LICENSE
├── package.json
├── server.json
├── glama.json
└── README.md
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `LIGUELEAD_API_TOKEN is required` | Set up `.env` or environment variables |
| `401 Unauthorized` | Check api-token and app-id in LigueLead panel |
| `429 Too Many Requests` | Rate limit exceeded — wait for reset |
| Upload rejected | Only MP3 and WAV accepted (no AAC/M4A) |
| Stale build | `rm -rf dist && npm run build` |

## License

MIT

---

---

# 🇧🇷 Documentação em Português

## LigueLead MCP Server

MCP Server para a API da LigueLead — SMS, SMS Flash e Campanhas de Voz no Brasil.

Permite que **Claude**, **Cursor**, **Windsurf** e qualquer agente de IA compatível com MCP enviem comunicações reais — sem código, sem setup complexo.

**CPaaS Brasileiro** · Preço em BRL · Pagamento via PIX · Suporte em PT-BR

### Início rápido

#### Opção 1: npx (recomendado)

Sem instalação — basta adicionar à config do seu cliente MCP:

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "npx",
      "args": ["-y", "@liguelead/mcp-server"],
      "env": {
        "LIGUELEAD_API_TOKEN": "seu-token",
        "LIGUELEAD_APP_ID": "seu-app-id",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

#### Opção 2: Clone & build

```bash
git clone https://github.com/liguelead/mcp.git
cd mcp
npm install
cp .env.example .env  # Edite com suas credenciais
npm run build
npm start
```

### Obtendo suas credenciais

1. Acesse [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Vá em **Integrações → API Token**
3. Crie um App e copie o **API Token** e **App ID**

### Tools disponíveis

| Tool | Descrição |
|------|-----------|
| `send_sms` | Envia campanha de SMS ou SMS Flash para números brasileiros |
| `list_voice_uploads` | Lista todos os áudios enviados |
| `get_voice_upload` | Detalhes de um áudio específico |
| `upload_voice_audio` | Upload de áudio MP3/WAV para campanhas de voz |
| `send_voice_message` | Dispara campanha de voz para lista de telefones |

### Configuração por cliente MCP

#### Claude Desktop (stdio)

Edite `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "npx",
      "args": ["-y", "@liguelead/mcp-server"],
      "env": {
        "LIGUELEAD_API_TOKEN": "seu-token",
        "LIGUELEAD_APP_ID": "seu-app-id",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

#### Claude Code

```bash
claude mcp add -s user liguelead \
  -e LIGUELEAD_API_TOKEN=seu-token \
  -e LIGUELEAD_APP_ID=seu-app-id \
  -e TRANSPORT=stdio \
  -- npx -y @liguelead/mcp-server
```

### Formato de números de telefone

| Formato | Exemplo | Dígitos |
|---------|---------|---------|
| Nacional (recomendado) | `11999999999` | 11 |
| Internacional | `+5511999999999` | 14 chars |
| DDI sem `+` | `5511999999999` | 13 |

### Limites de SMS

| Parte | Caracteres | Créditos |
|-------|-----------|----------|
| 1ª parte | até 160 | 1 crédito |
| Partes adicionais | a cada 152 chars | 1 crédito cada |
| Máximo total | 1.600 chars | ~11 créditos |

🚫 **SMS Flash NÃO permite URLs** no conteúdo da mensagem.

### Limites de voz

- **Formatos suportados:** MP3 e WAV (AAC e M4A não são suportados)
- **Tamanho máximo:** 50 MB (recomendado: 5–10 MB)
- **Cobrança:** Até 30s = 1 crédito; acima de 30s = 2 créditos
- **Janela de discagem:** 08h00–21h44 (America/Sao_Paulo). Requests após 21h45 ficam na fila até as 08h00.

### Webhook

1. Acesse [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Vá em **Integrações → API Token → Webhook URL**
3. Insira a URL HTTPS do seu endpoint
4. Salve

Uma única URL recebe notificações de todos os canais (SMS, SMS Flash, Voz).

⚠️ **CRÍTICO:** LigueLead NÃO faz retry. Se o endpoint falhar, o webhook é perdido permanentemente.
