# 📱 LigueLead MCP Server

> MCP Server for sending **SMS**, **SMS Flash**, **voice calls**, and **RCS** in Brazil via the [LigueLead API](https://docs.liguelead.com.br).
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
| `list_rcs_agents` | List RCS agents (sender brands) and their review status |
| `create_rcs_template_text` | Create a plain-text RCS template |
| `create_rcs_template_media` | Create an RCS template with image/video |
| `create_rcs_template_card` | Create a rich card RCS template with buttons |
| `create_rcs_template_carousel` | Create a carousel RCS template (2-10 cards) |
| `send_rcs` | Send an RCS campaign (template-based or freeform) |

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

A single URL receives notifications for all channels (SMS, SMS Flash, Voice, RCS).

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
- **Retries (`send_voice_message`):** `retry_attempts` (1–3, default 3), `retry_interval_min` (5–180, default 15) and `retry_end_time` (HH:MM, 08:00–21:45, at least 10 minutes from now)

## Per-send webhook

`send_sms`, `send_voice_message` and `send_rcs` accept an optional `webhook_url` that receives that send's status events instead of the app's webhook URL. It is called exactly as written, so it can carry your own identifiers (e.g. `?order=123`). Public `http`/`https` only, no `_` in the hostname, max 512 chars.

## RCS templates & limits

RCS campaigns are built from a template registered via one of the `create_rcs_template_*`
tools, then sent with `send_rcs` using the returned `template_id` (or as a freeform,
template-less message).

| Template type | Tool | Notes |
|----------------|------|-------|
| Text | `create_rcs_template_text` | Plain text, no media/buttons |
| Media | `create_rcs_template_media` | Image or short video (`media_url` or `media_file`, mutually exclusive) |
| Rich card | `create_rcs_template_card` | Optional media + 1-4 buttons (`reply`, `open_url`, `dial_call`) |
| Carousel | `create_rcs_template_carousel` | 2-10 rich cards; all cards must declare the same button count/type/order |

- `body` max 1,600 chars; supports `{{N}}` variable placeholders, overridable via `default_variables` (template) or `template_variables` (send time)
- `media_file` accepts a base64 data URI, max 5 MB decoded
- `fallback_message` (max 306 chars) is the SMS sent if RCS delivery fails
- `send_rcs` freeform `message` is capped at 306 chars (mutually exclusive with `template_id`) — reused as the SMS fallback
- `send_rcs` freeform `message` requires `agent_id` (see `list_rcs_agents`); template sends must omit it, since the template carries its own agent
- Async operation — returns 202 when queued; delivery status arrives via the configured webhook

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
│   │   ├── validators.ts  # Phone/RCS schemas (Zod)
│   │   └── webhook.ts     # Webhook handler + GET /webhooks
│   └── tools/
│       ├── sms.ts         # Tool: send_sms
│       ├── voice.ts       # Tools: voice (list/get/upload/send)
│       └── rcs.ts         # Tools: RCS (templates + send_rcs)
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
| `429 Too Many Requests` | Rate limit exceeded — wait for reset, group phones in one call |
| `429 Failed to call ligueapi-backend` on `send_rcs` | LigueLead's internal agent validation is throttled (the send was not queued). Use `retry_when_busy: true`, space out calls or group phones in one call |
| Any other error | Errors include the HTTP status, LigueLead's reason, what it means and support IDs (`x-amzn-requestid`) to send to LigueLead |
| Upload rejected | Only MP3 and WAV accepted (no AAC/M4A) |
| Stale build | `rm -rf dist && npm run build` |

## License

MIT

---

---

# 🇧🇷 Documentação em Português

## LigueLead MCP Server

MCP Server para a API da LigueLead — SMS, SMS Flash, Campanhas de Voz e RCS no Brasil.

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
| `list_rcs_agents` | Lista os agentes de RCS (marcas remetentes) e o status de aprovação |
| `create_rcs_template_text` | Cria um template de RCS somente texto |
| `create_rcs_template_media` | Cria um template de RCS com imagem/vídeo |
| `create_rcs_template_card` | Cria um template de RCS com rich card e botões |
| `create_rcs_template_carousel` | Cria um template de RCS carrossel (2-10 cards) |
| `send_rcs` | Dispara uma campanha de RCS (com template ou texto livre) |

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
- **Retentativas (`send_voice_message`):** `retry_attempts` (1–3, padrão 3), `retry_interval_min` (5–180, padrão 15) e `retry_end_time` (HH:MM, entre 08:00 e 21:45, pelo menos 10 minutos à frente)

### Webhook por envio

`send_sms`, `send_voice_message` e `send_rcs` aceitam um `webhook_url` opcional, que recebe os status daquele envio no lugar do webhook do app. Ele é chamado exatamente como escrito, então pode levar seus identificadores (ex.: `?pedido=123`). Só `http`/`https` público, sem `_` no domínio, até 512 caracteres.

### Erros

Todo erro traz o status HTTP, o motivo informado pela LigueLead, o que ele significa e IDs para o suporte (`x-amzn-requestid`). O `429 Failed to call ligueapi-backend` no `send_rcs` é o limite interno da validação do agente da LigueLead (o envio não foi enfileirado): use `retry_when_busy: true`, espace os envios ou agrupe os telefones numa chamada.

### Templates e limites de RCS

Uma campanha de RCS é criada a partir de um template registrado com uma das tools
`create_rcs_template_*`, e enviada com `send_rcs` usando o `template_id` retornado
(ou como mensagem livre, sem template).

| Tipo de template | Tool | Observações |
|-------------------|------|--------------|
| Texto | `create_rcs_template_text` | Somente texto, sem mídia/botões |
| Mídia | `create_rcs_template_media` | Imagem ou vídeo curto (`media_url` ou `media_file`, mutuamente exclusivos) |
| Rich card | `create_rcs_template_card` | Mídia opcional + 1-4 botões (`reply`, `open_url`, `dial_call`) |
| Carrossel | `create_rcs_template_carousel` | 2-10 rich cards; todos os cards devem declarar o mesmo número/tipo/ordem de botões |

- `body` até 1.600 chars; suporta placeholders `{{N}}`, sobrescrevíveis via `default_variables` (template) ou `template_variables` (no envio)
- `media_file` aceita um data URI em base64, máximo 5 MB decodificado
- `fallback_message` (máx 306 chars) é o SMS enviado caso a entrega via RCS falhe
- O `message` livre do `send_rcs` é limitado a 306 chars (mutuamente exclusivo com `template_id`) — reaproveitado como fallback de SMS
- O `message` livre do `send_rcs` exige `agent_id` (veja `list_rcs_agents`); no envio com template ele não deve ser enviado, pois o template já tem o agente dele
- Operação assíncrona — retorna 202 ao ser enfileirada; o status chega pelo webhook configurado

### Webhook

1. Acesse [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Vá em **Integrações → API Token → Webhook URL**
3. Insira a URL HTTPS do seu endpoint
4. Salve

Uma única URL recebe notificações de todos os canais (SMS, SMS Flash, Voz, RCS).

⚠️ **CRÍTICO:** LigueLead NÃO faz retry. Se o endpoint falhar, o webhook é perdido permanentemente.
