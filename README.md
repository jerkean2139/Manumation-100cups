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
- **No `APP_PASSWORD`** → dashboard runs **open** (fine for local). Set it to gate the app.

### Auth & tenancy

- **Single-user password** (`APP_PASSWORD`). The dashboard and `/api/*` are gated by a
  signed session token (HMAC, no extra deps); the SPA shows a login screen and stores
  the token. The GHL webhook is exempt — it authenticates with its own
  `GHL_WEBHOOK_SECRET`, since GHL can't carry a user session.
- **Tenant-ready, single-tenant v1.** Every contact is scoped to a `location` keyed by
  GHL's `locationId` — exactly GHL's structure (Agency → Locations → Contacts). v1 runs
  one location (Jeremy); growing into a multi-tenant marketplace app later is additive
  (add OAuth + onboarding), not a schema migration.

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

1. **New Project → Deploy from GitHub repo** → pick this repo (`main`).
2. **Add a PostgreSQL plugin.** Railway injects `DATABASE_URL` automatically. The
   schema is created on first boot — no manual migration step (see below).
3. **Set environment variables** on the service:
   - `ANTHROPIC_API_KEY` — required for the engines
   - `APP_PASSWORD` — gate the dashboard (strongly recommended)
   - `AUTH_SECRET` — a long random string for signing sessions
   - `GHL_API_TOKEN`, `GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET` — when connecting GHL
   - `NODE_ENV=production`
4. Railway uses `railway.json`: it builds the client + server, runs `npm run start`,
   and health-checks `/health`. The Express server serves the built client from
   `client/dist`, so it's a single service.
5. Point a GHL workflow webhook at `POST /webhooks/ghl/inbound-message` (add the
   `x-ghl-secret` header matching `GHL_WEBHOOK_SECRET`).

### Schema migrations

On boot, the server runs an **idempotent bootstrap** (`server/src/db/bootstrap.ts`)
that creates every table `IF NOT EXISTS` and seeds the default location — so a fresh
Railway deploy comes up ready, and restarts are safe. (`npm run db:push` is also
available for applying the Drizzle schema directly during development.)

---

## Database tables

`locations` · `contacts` · `memories` · `snapshots` · `message_drafts` · `settings` · `audit_logs` · `conversation_events`

(`locations` is the tenant boundary; `contacts.location_id` scopes everyone to a GHL location.)

Schema lives in `server/src/db/schema.ts`. Generate/apply migrations with
`npm run db:generate` / `npm run db:push`.

---

## Roadmap

V1 (this build): inbound reply assistant — remembering first.
Then: outbound follow-up · workflow message generation · voicemail scripts · AI voice · 100 Cups Snapshot · marketplace app.

The foundation is remembering. Everything else is built on top of that.
