---
name: liguelead-api
description: >
  Send voice calls, SMS, and SMS Flash messages in Brazil via the LigueLead API.
  Use this skill whenever the user mentions LigueLead, wants to send automated
  calls, SMS blasts, SMS Flash, or configure webhooks for campaign status.
  Also use when the user asks about credentials, authentication, API limits,
  or integration best practices with LigueLead.
---

# LigueLead API – Integration Skill

## Overview

LigueLead is a Brazilian communications platform for voice and SMS. This skill covers:

- **Authentication** via dual-header (`api-token` + `app-id`)
- **Voice calls** (2-step process: upload audio → send campaign)
- **SMS** (standard and Flash) in a single request
- **Webhooks** for real-time campaign status

**Base URL:** `https://api.liguelead.com.br/v1`

---

## 1. Authentication

Every request requires **two mandatory headers**:

```http
api-token: YOUR_API_TOKEN
app-id:    YOUR_APP_ID
Content-Type: application/json
```

**Where to get them:** LigueLead Dashboard → **Integrações → API Token**
([areadocliente.liguelead.app.br](https://areadocliente.liguelead.app.br/))

> ⚠️ Never expose `api-token` or `app-id` in client-side code. Use environment variables.

---

## 2. Phone number format

The API accepts three Brazilian phone number formats:

| Format | Example | Digits |
|--------|---------|--------|
| National (recommended) | `11999999999` | 11 |
| International | `+5511999999999` | 14 chars |
| DDI without `+` | `5511999999999` | 13 |

> **Recommendation:** use the national format (11 digits) for best compatibility.

---

## 3. Sending voice calls

Voice sending is a **2-step process**.

### Step 1 — Upload audio

**`POST /v1/voice/uploads`** — `multipart/form-data`

```bash
curl -X POST "https://api.liguelead.com.br/v1/voice/uploads" \
  -H "api-token: YOUR_API_TOKEN" \
  -H "app-id: YOUR_APP_ID" \
  -F "title=My Message" \
  -F "file=@/path/to/audio.mp3"
```

**Response (201):**
```json
{
  "message": "Voice upload successful.",
  "data": {
    "id": 436514,
    "title": "My Message"
  }
}
```

> Save the `id` — it's the `voice_upload_id` for the next step.

**File limits:**
- Supported formats: **MP3** and **WAV** (AAC and M4A not supported)
- Max size: **50 MB** (recommended: 5–10 MB)
- Storage per account: 10 GB | Max 1,000 active files

**Convert with FFmpeg:**
```bash
ffmpeg -i input.aac -f mp3 output.mp3
ffmpeg -i input.wav -ar 16000 -ab 128k -ac 1 -f mp3 output.mp3
```

### Step 2 — Send the call

**`POST /v1/voice`**

```bash
curl -X POST "https://api.liguelead.com.br/v1/voice" \
  -H "api-token: YOUR_API_TOKEN" \
  -H "app-id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Voice Campaign - Black Friday",
    "voice_upload_id": 436514,
    "phones": ["11999999999", "+5521888888888"],
    "group_id": "optional-group-id"
  }'
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Campaign identifier |
| `voice_upload_id` | integer | ✅ | Audio upload ID |
| `phones` | array | ✅ | Phone list (up to 10,000) |
| `group_id` | string | ❌ | Contact group ID |

**Response (202 Accepted):**
```json
{
  "message": "Voice accepted successfully",
  "data": {
    "campaign_id": "3b4f7c5e-7e2d-4157-b542-5eb2155455c5",
    "accepted_at": "2025-12-29T18:34:38.961Z"
  }
}
```

> ⏰ **Dialing window:** Calls are only dialed between **08:00 and 21:44 (America/Sao_Paulo)**. Requests after 21:45 are queued until 08:00.

---

## 4. Sending SMS (standard and Flash)

**`POST /v1/sms`** — **1-step process** (simpler than voice).

```bash
curl -X POST "https://api.liguelead.com.br/v1/sms" \
  -H "api-token: YOUR_API_TOKEN" \
  -H "app-id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Welcome Campaign",
    "message": "Hello! Welcome to LigueLead.",
    "phones": ["11999999999", "21888888888"],
    "group_id": "optional-group-id",
    "is_flash": false
  }'
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | ✅ | SMS content |
| `phones` | array | ✅ | Phone list |
| `title` | string | ❌ | Campaign identifier |
| `group_id` | string | ❌ | Group ID |
| `is_flash` | boolean | ❌ | `true` for SMS Flash, `false` (default) for standard SMS |

**Response (202 Accepted):**
```json
{
  "message": "SMS accepted successfully",
  "data": {
    "campaign_id": "3b4f7c5e-7e2d-4157-b542-5eb2155455c5",
    "accepted_at": "2025-12-29T18:34:38.961Z"
  }
}
```

**SMS limits:**

| Part | Characters | Credits |
|------|-----------|---------|
| 1st part | up to 160 | 1 credit |
| Additional parts | every 152 chars | 1 credit each |
| Maximum total | 1,600 chars | ~11 credits |

> 🚫 **SMS Flash does NOT allow URLs** in message content.

---

## 5. Webhooks — Receive campaign status

### Quick setup

1. Go to LigueLead Dashboard → **Integrações → API Token**
2. Find the **"Webhook URL"** section
3. Enter your public HTTPS endpoint URL
4. Save

**A single URL receives notifications for all channels** (SMS, SMS Flash, Voice). Use `campaign.type` and `campaign.is_flash` to differentiate.

### Payload structure (all channels)

```json
{
  "event": "campaign.status",
  "app_id": "your-app-id",
  "occurred_at": "2026-02-02T12:00:15.400Z",
  "campaign": {
    "id": "campaign-uuid-v4",
    "type": "sms",
    "source": "api",
    "phone": "+5513991884678",
    "credits_required": 1,
    "sent_at": "2026-02-02",
    "status": "delivered",
    "message": "SMS text content",
    "is_flash": false
  }
}
```

**Channel-specific fields:**

| Channel | Extra fields |
|---------|-------------|
| SMS / SMS Flash | `campaign.message`, `campaign.is_flash` |
| Voice | voice-specific call fields |

### Possible statuses

**SMS / SMS Flash:**

| Status | Description |
|--------|------------|
| `sent` | Sent to carrier |
| `delivered` | Delivered to recipient |
| `undelivered` | Not delivered (timeout or rejection) |
| `failed` | Failed (error, congestion, no route) |

### Endpoint requirements

- Protocol **HTTPS**
- Respond with **HTTP 200** within **5 seconds**
- ⚠️ **LigueLead does NOT retry.** If the endpoint fails, the webhook is permanently lost.

---

## 6. Rate limits

| Limit | Value |
|-------|-------|
| Requests per minute | 600,000 |
| Simultaneous requests | 10,000 |
| Recipients per request | 10,000 |

Response when exceeded: `429 Too Many Requests`

Headers:
```http
X-RateLimit-Limit: 600000
X-RateLimit-Remaining: 599950
X-RateLimit-Reset: 1640995260
```

---

## 7. Error codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (audio upload) |
| `202` | Accepted (async operation queued) |
| `400` | Invalid request |
| `401` | Unauthorized (check `api-token` and `app-id`) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## 8. Best practices

- **Reuse audio:** upload once, use the same `voice_upload_id` across multiple campaigns
- **Batch first:** send to many numbers in a single request (up to 10k) instead of multiple individual requests
- **Respond fast on webhook:** return HTTP 200 immediately and process in background (queue/worker)
- **Idempotency on webhook:** use `campaign.id + campaign.status + occurred_at` as unique key to avoid duplicate processing
- **Logs:** record all received webhooks — there is no retry
- **LGPD:** only send to contacts with explicit consent
