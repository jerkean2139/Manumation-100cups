import "dotenv/config";

/**
 * Centralized, validated environment access.
 * Fails loud at boot for anything that would silently break a core flow.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "8080")),

  databaseUrl: optional("DATABASE_URL"),

  anthropic: {
    apiKey: optional("ANTHROPIC_API_KEY"),
    model: optional("ANTHROPIC_MODEL", "claude-opus-4-8"),
  },

  ghl: {
    apiBase: optional("GHL_API_BASE", "https://services.leadconnectorhq.com"),
    apiToken: optional("GHL_API_TOKEN"),
    locationId: optional("GHL_LOCATION_ID"),
    webhookSecret: optional("GHL_WEBHOOK_SECRET"),
  },

  humanityThreshold: Number(optional("HUMANITY_THRESHOLD", "95")),
  senderName: optional("SENDER_NAME", "Jeremy Kean"),

  get isProduction() {
    return this.nodeEnv === "production";
  },
} as const;

/** True only when the AI engine is actually wired up. */
export const hasAnthropic = () => Boolean(env.anthropic.apiKey);

/** True only when the GHL connector can reach the CRM. */
export const hasGhl = () => Boolean(env.ghl.apiToken && env.ghl.locationId);

export { required };
