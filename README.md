# Manumation Snapshot

> Most CRM systems help people manage contacts.
> **Manumation Snapshot helps people remember people.**

A Relationship Intelligence Layer that sits on top of [Go High Level](https://www.gohighlevel.com/). It transforms CRM data into relationship *context* — so that when a message comes in, you can reply like you actually remembered the person, not like you have good automation.

**GHL knows what happened. Manumation knows what mattered.**

---

## The hero flow — Inbound Inbox Reply Assistant

When a message arrives in GHL:

1. Pull the contact, notes, conversations, and custom fields *(GHL Connector)*
2. Extract durable relationship memories *(Memory Engine)*
3. Build a living relationship snapshot + scores *(Relationship Engine)*
4. Surface the **Next Best Conversation** — the hero metric
5. Write two replies in Jeremy's voice — warm & direct *(Jeremy Voice Engine)*
6. Grade both on seven humanity dimensions; rewrite anything below 95 *(Humanity Auditor)*
7. Present for **Approve / Edit / Regenerate / Delete / Save Memory**
8. Send the approved reply back through GHL

The goal of a successful interaction: the recipient thinks *"Jeremy remembered that"* — never *"Jeremy has good automation."*

---

## Architecture

```
GHL → Webhook → Railway Middleware
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Memory Engine          Relationship Engine
        │                       │
        └─────────┬─────────────┘
                  ▼
          Jeremy Voice Engine
                  ▼
           Humanity Auditor
                  ▼
              GHL Inbox
```

### Stack

| Layer     | Tech                                              |
| --------- | ------------------------------------------------- |
| Frontend  | React, TypeScript, Tailwind, Vite                 |
| Backend   | Node.js, Express, TypeScript                      |
| Database  | PostgreSQL + Drizzle ORM                          |
| AI engine | Claude (`claude-opus-4-8`) via `@anthropic-ai/sdk` |
| Hosting   | Railway                                           |

### The five modules (`server/src/modules/`)

| Module               | Responsibility                                              |
| -------------------- | ----------------------------------------------------------- |
| `ghl-connector.ts`   | Pull contacts/notes/conversations; push messages & notes    |
| `memory-engine.ts`   | Extract relationship memories (the moat)                    |
| `relationship-engine.ts` | Build scores, stage, season, next best conversation     |
| `voice-engine.ts`    | Write two replies in Jeremy's voice                         |
| `humanity-auditor.ts`| Grade replies; reject/rewrite anything below the threshold  |
| `snapshot.ts`        | Orchestrate the full inbound workflow                       |

---

## Local development

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#   Set ANTHROPIC_API_KEY (required for the engines).
#   DATABASE_URL and GHL_* are optional — the app runs in demo mode without them.

# 3. (Optional) create the database schema
npm run db:push

# 4. Run the API (port 8080)
npm run dev

# 5. Run the client (port 5173, proxies to the API)
npm run dev:client
```

Open <http://localhost:5173>. Two demo contacts (Sarah, Marcus) are available so the full flow works **before** GHL is connected — pick one, paste an inbound message, and Build Snapshot.

### Graceful degradation

Each dependency is optional and the app tells you what's online at `/health`:

- **No `ANTHROPIC_API_KEY`** → engines are offline (everything else still serves).
- **No `DATABASE_URL`** → no persistence; the live flow still works.
- **No GHL token** → demo mode; approved replies aren't sent, memories aren't mirrored to GHL notes.

---

## API

| Method | Path                              | Purpose                              |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/health`                         | Engine/connection status             |
| POST   | `/webhooks/ghl/inbound-message`   | GHL inbound trigger → full snapshot  |
| POST   | `/api/snapshot/build`             | Build a snapshot on demand           |
| POST   | `/api/drafts/regenerate`          | Regenerate one or both replies       |
| POST   | `/api/drafts/approve`             | Approve (and send via GHL)           |
| POST   | `/api/memories/save`              | Save a memory (DB + GHL note)        |
| GET    | `/api/contact/:id`                | Contact profile + history            |
| GET    | `/api/contacts`                   | List (demo) contacts                 |
| GET/POST | `/api/settings`                 | Auto-mode, humanity threshold, voice |

### Example

```bash
curl -s localhost:8080/api/snapshot/build \
  -H 'content-type: application/json' \
  -d '{"contactId":"demo-sarah","channel":"sms",
       "inboundMessage":"We signed the lease on the Westfield space today!!"}' | jq
```

---

## Deploy to Railway

1. Provision a **PostgreSQL** plugin (sets `DATABASE_URL`).
2. Set `ANTHROPIC_API_KEY`, and the `GHL_*` variables when ready.
3. Railway uses `railway.json`: builds the client + server, runs `npm run start`,
   health-checks `/health`. The Express server serves the built client from
   `client/dist`.
4. Point a GHL workflow webhook at `POST /webhooks/ghl/inbound-message`.

---

## Database tables

`contacts` · `memories` · `snapshots` · `message_drafts` · `settings` · `audit_logs` · `conversation_events`

Schema lives in `server/src/db/schema.ts`. Generate/apply migrations with
`npm run db:generate` / `npm run db:push`.

---

## Roadmap

V1 (this build): inbound reply assistant — remembering first.
Then: outbound follow-up · workflow message generation · voicemail scripts · AI voice · 100 Cups Snapshot · marketplace app.

The foundation is remembering. Everything else is built on top of that.
