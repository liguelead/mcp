# 📱 LigueLead MCP Server

**MCP Server para a API da LigueLead — SMS, SMS Flash e Campanhas de Voz (Brasil)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![MCP SDK](https://img.shields.io/badge/MCP-SDK-purple.svg)](https://modelcontextprotocol.io)

---

## 🇧🇷 Português

### Tools disponíveis

| Tool | Descrição |
|---|---|
| `send_sms` | Envia campanha de SMS ou SMS Flash |
| `list_voice_uploads` | Lista todos os áudios enviados |
| `get_voice_upload` | Detalhes de um áudio específico |
| `upload_voice_audio` | Upload de áudio MP3/WAV para campanhas de voz |
| `send_voice_message` | Dispara campanha de voz para lista de telefones |

### Início rápido

```bash
git clone https://github.com/your-org/liguelead-mcp.git
cd liguelead-mcp
npm install
cp .env.example .env
# Edite .env com suas credenciais (painel: areadocliente.liguelead.app.br → Integrações → API Token)
npm run build
npm start
```

O servidor inicia em `http://localhost:3000` por padrão.

### Transportes

| Transporte | Uso | Variável |
|---|---|---|
| **Streamable HTTP** (padrão) | Servidor remoto, qualquer cliente MCP | `TRANSPORT=http` |
| **stdio** | Local, Claude Desktop / Claude Code | `TRANSPORT=stdio` |

### Configuração por cliente MCP

#### Claude Desktop (stdio)

Edite `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "node",
      "args": ["/caminho/absoluto/para/liguelead-mcp/dist/index.js"],
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
  -- node /caminho/absoluto/para/liguelead-mcp/dist/index.js
```

#### Servidor HTTP remoto

Qualquer cliente MCP que suporte Streamable HTTP pode conectar via:

```
POST https://seu-servidor.com/mcp
```

Credenciais ficam no servidor — o cliente não precisa delas.

#### mcp-remote bridge

Para clientes que não suportam HTTP nativo (ex: Claude Desktop conectando a servidor remoto):

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "npx",
      "args": ["mcp-remote", "https://seu-servidor.com/mcp"]
    }
  }
}
```

### Deploy

#### Docker

```bash
docker build -t liguelead-mcp .
docker run -d -p 3000:3000 \
  -e LIGUELEAD_API_TOKEN=seu-token \
  -e LIGUELEAD_APP_ID=seu-app-id \
  liguelead-mcp
```

#### Railway / Render

1. Conecte o repositório Git
2. Configure as variáveis de ambiente: `LIGUELEAD_API_TOKEN`, `LIGUELEAD_APP_ID`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

### Segurança das credenciais

| Cenário | Onde ficam as credenciais |
|---|---|
| stdio (local) | Variáveis de ambiente na config do cliente |
| HTTP (remoto) | Variáveis de ambiente no servidor |
| Docker | `-e` flags ou secrets do orquestrador |
| CI/CD | Secrets do provedor (GitHub Actions, etc.) |

> ⚠️ Credenciais NUNCA ficam no código. O `.env` está no `.gitignore`.

### Webhook

#### Configurar no painel LigueLead

1. Acesse [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Vá em **Integrações → API Token → Webhook URL**
3. Insira: `https://seu-servidor.com/webhook`
4. Salve

Uma única URL recebe notificações de **todos os canais** (SMS, SMS Flash, Voz).

#### Consultar webhooks recebidos

```bash
# Via curl
curl http://localhost:3000/webhooks

# Ou abra no navegador
http://localhost:3000/webhooks
```

Retorna:
```json
{
  "total": 42,
  "webhooks": [...]
}
```

> ⚠️ **CRÍTICO:** LigueLead NÃO faz retry. Se o endpoint falhar, a notificação é perdida permanentemente.

### Referência das tools

#### send_sms

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `message` | string | ✅ | Conteúdo do SMS (max 1600 chars) |
| `phones` | string[] | ✅ | Telefones brasileiros (max 10.000) |
| `title` | string | ❌ | Identificador da campanha |
| `group_id` | string | ❌ | ID do grupo de contatos |
| `is_flash` | boolean | ❌ | `true` = Flash (sem URLs), `false` = padrão |

#### upload_voice_audio

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `title` | string | ✅ | Título do áudio |
| `file_base64` | string | ✅ | Conteúdo do arquivo em Base64 |
| `filename` | string | ✅ | Nome com extensão (ex: `audio.mp3`) |

Formatos aceitos: MP3, WAV. Máx: 50 MB.

#### send_voice_message

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `title` | string | ✅ | Título da campanha |
| `voice_upload_id` | number | ✅ | ID do upload prévio |
| `phones` | string[] | ✅ | Telefones brasileiros (max 10.000) |
| `group_id` | string | ❌ | ID do grupo de contatos |

Janela de discagem: 08:00–21:44 (America/Sao_Paulo).

#### list_voice_uploads

Sem parâmetros. Lista todos os áudios enviados.

#### get_voice_upload

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | number | ✅ | ID do upload |

### Estrutura do projeto

```
liguelead-mcp/
├── src/
│   ├── index.ts           # Entry point — HTTP ou stdio
│   ├── config.ts          # Validação de env vars (Zod) + loader .env
│   ├── lib/
│   │   ├── api-client.ts  # Client HTTP para API LigueLead
│   │   ├── validators.ts  # Schemas de telefone BR (Zod)
│   │   └── webhook.ts     # Webhook handler + GET /webhooks
│   └── tools/
│       ├── sms.ts         # Tool: send_sms
│       └── voice.ts       # Tools: voice (list/get/upload/send)
├── .env.example
├── .gitignore
├── Dockerfile
├── LICENSE
├── package.json
├── server.json
├── glama.json
├── tsconfig.json
└── README.md
```

### Troubleshooting

| Problema | Solução |
|---|---|
| `LIGUELEAD_API_TOKEN is required` | Configure o `.env` ou variáveis de ambiente |
| Webhook não salva | Certifique-se de rodar `npm start` de dentro da pasta do projeto |
| Build stale | `rm -rf dist && npm run build` |
| 401 Unauthorized | Verifique `api-token` e `app-id` no painel LigueLead |
| 429 Too Many Requests | Rate limit excedido — aguarde o reset |
| Upload rejeita arquivo | Apenas MP3 e WAV são aceitos (AAC/M4A não) |

---

## 🇺🇸 English

### Available tools

| Tool | Description |
|---|---|
| `send_sms` | Send an SMS or SMS Flash campaign |
| `list_voice_uploads` | List all uploaded audio files |
| `get_voice_upload` | Get details of a specific audio upload |
| `upload_voice_audio` | Upload MP3/WAV audio for voice campaigns |
| `send_voice_message` | Send a voice campaign to a phone list |

### Quick start

```bash
git clone https://github.com/your-org/liguelead-mcp.git
cd liguelead-mcp
npm install
cp .env.example .env
# Edit .env with your credentials (panel: areadocliente.liguelead.app.br → Integrações → API Token)
npm run build
npm start
```

Server starts at `http://localhost:3000` by default.

### Transports

| Transport | Use case | Variable |
|---|---|---|
| **Streamable HTTP** (default) | Remote server, any MCP client | `TRANSPORT=http` |
| **stdio** | Local, Claude Desktop / Claude Code | `TRANSPORT=stdio` |

### MCP client configuration

#### Claude Desktop (stdio)

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "liguelead": {
      "command": "node",
      "args": ["/absolute/path/to/liguelead-mcp/dist/index.js"],
      "env": {
        "LIGUELEAD_API_TOKEN": "your-token",
        "LIGUELEAD_APP_ID": "your-app-id",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

#### Claude Code

```bash
claude mcp add -s user liguelead \
  -e LIGUELEAD_API_TOKEN=your-token \
  -e LIGUELEAD_APP_ID=your-app-id \
  -e TRANSPORT=stdio \
  -- node /absolute/path/to/liguelead-mcp/dist/index.js
```

#### Remote HTTP server

Any MCP client supporting Streamable HTTP can connect via:

```
POST https://your-server.com/mcp
```

Credentials stay on the server — the client doesn't need them.

#### mcp-remote bridge

For clients without native HTTP support (e.g., Claude Desktop connecting to a remote server):

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

### Deploy

#### Docker

```bash
docker build -t liguelead-mcp .
docker run -d -p 3000:3000 \
  -e LIGUELEAD_API_TOKEN=your-token \
  -e LIGUELEAD_APP_ID=your-app-id \
  liguelead-mcp
```

#### Railway / Render

1. Connect your Git repository
2. Set environment variables: `LIGUELEAD_API_TOKEN`, `LIGUELEAD_APP_ID`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

### Credential security

| Scenario | Where credentials live |
|---|---|
| stdio (local) | Environment variables in client config |
| HTTP (remote) | Environment variables on the server |
| Docker | `-e` flags or orchestrator secrets |
| CI/CD | Provider secrets (GitHub Actions, etc.) |

> ⚠️ Credentials NEVER go in code. `.env` is in `.gitignore`.

### Webhook

#### Configure in LigueLead panel

1. Go to [areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/)
2. Navigate to **Integrações → API Token → Webhook URL**
3. Enter: `https://your-server.com/webhook`
4. Save

A single URL receives notifications from **all channels** (SMS, SMS Flash, Voice).

#### Query received webhooks

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

> ⚠️ **CRITICAL:** LigueLead does NOT retry webhooks. If the endpoint fails, the notification is permanently lost.

### Tool reference

#### send_sms

| Parameter | Type | Required | Description |
|---|---|---|---|
| `message` | string | ✅ | SMS content (max 1600 chars) |
| `phones` | string[] | ✅ | Brazilian phones (max 10,000) |
| `title` | string | ❌ | Campaign identifier |
| `group_id` | string | ❌ | Contact group ID |
| `is_flash` | boolean | ❌ | `true` = Flash (no URLs), `false` = standard |

#### upload_voice_audio

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Audio title |
| `file_base64` | string | ✅ | Base64-encoded file content |
| `filename` | string | ✅ | Filename with extension (e.g., `audio.mp3`) |

Accepted formats: MP3, WAV. Max: 50 MB.

#### send_voice_message

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Campaign title |
| `voice_upload_id` | number | ✅ | ID from previous upload |
| `phones` | string[] | ✅ | Brazilian phones (max 10,000) |
| `group_id` | string | ❌ | Contact group ID |

Dialing window: 08:00–21:44 (America/Sao_Paulo).

#### list_voice_uploads

No parameters. Lists all uploaded audio files.

#### get_voice_upload

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | number | ✅ | Upload ID |

### Project structure

```
liguelead-mcp/
├── src/
│   ├── index.ts           # Entry point — HTTP or stdio
│   ├── config.ts          # Env var validation (Zod) + .env loader
│   ├── lib/
│   │   ├── api-client.ts  # HTTP client for LigueLead API
│   │   ├── validators.ts  # Brazilian phone schemas (Zod)
│   │   └── webhook.ts     # Webhook handler + GET /webhooks
│   └── tools/
│       ├── sms.ts         # Tool: send_sms
│       └── voice.ts       # Tools: voice (list/get/upload/send)
├── .env.example
├── .gitignore
├── Dockerfile
├── LICENSE
├── package.json
├── server.json
├── glama.json
├── tsconfig.json
└── README.md
```

### Troubleshooting

| Problem | Solution |
|---|---|
| `LIGUELEAD_API_TOKEN is required` | Set up `.env` or environment variables |
| Webhook not saving | Make sure to run `npm start` from inside the project folder |
| Stale build | `rm -rf dist && npm run build` |
| 401 Unauthorized | Check `api-token` and `app-id` in LigueLead panel |
| 429 Too Many Requests | Rate limit exceeded — wait for reset |
| Upload rejected | Only MP3 and WAV accepted (no AAC/M4A) |

---

## License

[MIT](LICENSE)
