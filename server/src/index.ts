import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { env, hasAnthropic, hasGhl, authEnabled } from "./env.js";
import { hasDb } from "./db/index.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { router } from "./routes/api.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// API + webhook + health routes.
app.use(router);

// ── Serve the built client in production ─────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — anything that isn't an API/webhook route serves index.html.
  app.get(/^(?!\/(api|webhooks|health)).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

async function start() {
  // Create the schema on first boot (idempotent). Don't crash the app if the
  // DB is briefly unavailable — log and continue; the next request/restart retries.
  if (hasDb()) {
    try {
      await bootstrapDatabase();
    } catch (err) {
      console.error("  Database bootstrap failed:", (err as Error).message);
    }
  }

  app.listen(env.port, () => {
    console.log(`\n  Manumation Snapshot — helping ${env.senderName} remember people.`);
    console.log(`  Listening on http://localhost:${env.port}`);
    console.log(`  Relationship Engine: ${hasAnthropic() ? "online" : "OFFLINE (set ANTHROPIC_API_KEY)"}`);
    console.log(`  GHL Connector:       ${hasGhl() ? "connected" : "offline (demo mode)"}`);
    console.log(`  Database:            ${hasDb() ? "connected" : "offline (no persistence)"}`);
    console.log(`  Dashboard auth:      ${authEnabled() ? "enabled" : "OPEN (set APP_PASSWORD)"}\n`);
  });
}

void start();
