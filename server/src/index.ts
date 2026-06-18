import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { env, hasAnthropic, hasGhl } from "./env.js";
import { hasDb } from "./db/index.js";
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

app.listen(env.port, () => {
  console.log(`\n  Manumation Snapshot — helping ${env.senderName} remember people.`);
  console.log(`  Listening on http://localhost:${env.port}`);
  console.log(`  Relationship Engine: ${hasAnthropic() ? "online" : "OFFLINE (set ANTHROPIC_API_KEY)"}`);
  console.log(`  GHL Connector:       ${hasGhl() ? "connected" : "offline (demo mode)"}`);
  console.log(`  Database:            ${hasDb() ? "connected" : "offline (no persistence)"}\n`);
});
