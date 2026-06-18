import type { ContactContext } from "../types.js";

/**
 * Render everything we know about a contact into a compact, readable block
 * for the engines. Order matters: identity first, then the human history.
 */
export function formatContext(ctx: ContactContext): string {
  const lines: string[] = [];

  lines.push(`CONTACT: ${ctx.name}`);
  if (ctx.email) lines.push(`Email: ${ctx.email}`);
  if (ctx.phone) lines.push(`Phone: ${ctx.phone}`);
  if (ctx.tags.length) lines.push(`Tags: ${ctx.tags.join(", ")}`);

  const fields = Object.entries(ctx.customFields).filter(([, v]) => v);
  if (fields.length) {
    lines.push("");
    lines.push("CUSTOM FIELDS:");
    for (const [k, v] of fields) lines.push(`- ${k}: ${v}`);
  }

  if (ctx.notes.length) {
    lines.push("");
    lines.push("NOTES (most recent first):");
    for (const note of ctx.notes.slice(0, 30)) {
      const when = note.createdAt ? ` [${note.createdAt}]` : "";
      lines.push(`- ${note.body}${when}`);
    }
  }

  if (ctx.conversations.length) {
    lines.push("");
    lines.push("CONVERSATION HISTORY (most recent first):");
    for (const msg of ctx.conversations.slice(0, 50)) {
      const who = msg.direction === "inbound" ? ctx.name : "Jeremy";
      const when = msg.createdAt ? ` [${msg.createdAt}]` : "";
      lines.push(`- (${msg.channel}) ${who}: ${msg.body}${when}`);
    }
  }

  if (!ctx.notes.length && !ctx.conversations.length && !fields.length) {
    lines.push("");
    lines.push("(No history yet. This is a new or thin relationship.)");
  }

  return lines.join("\n");
}
