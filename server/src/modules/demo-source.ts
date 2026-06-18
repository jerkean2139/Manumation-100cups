import type { ContactContext } from "../types.js";

/**
 * Demo relationship data.
 *
 * Lets the full inbound flow (memory → snapshot → replies → audit) run end to
 * end before GHL credentials are wired up, so the relationship intelligence is
 * demonstrable on day one. These are realistic, history-rich contacts.
 */

export const DEMO_CONTACTS: Record<string, ContactContext> = {
  "demo-sarah": {
    ghlContactId: "demo-sarah",
    name: "Sarah Whitfield",
    email: "sarah@brightpathpt.com",
    phone: "+13175550142",
    tags: ["clinic-owner", "warm", "spoke-at-summit"],
    customFields: {
      business: "Bright Path Physical Therapy",
      city: "Carmel, IN",
    },
    notes: [
      {
        body: "Sarah is opening a second Bright Path location in Westfield in the spring. Nervous about hiring the right front-desk lead. Got burned last time.",
        createdAt: "2026-05-02",
      },
      {
        body: "Her son Eli made the varsity soccer team as a freshman. She's thrilled, drives him to 6am practices.",
        createdAt: "2026-04-18",
      },
      {
        body: "Mentioned she's been reading more lately to wind down. Finished a Brené Brown book she loved.",
        createdAt: "2026-03-30",
      },
    ],
    conversations: [
      {
        direction: "outbound",
        channel: "sms",
        body: "Sarah! Congrats again on the summit talk. The bit about treating patients like neighbors stuck with me.",
        createdAt: "2026-04-10",
      },
      {
        direction: "inbound",
        channel: "sms",
        body: "That means a lot, thank you Jeremy. Still buzzing from it honestly.",
        createdAt: "2026-04-10",
      },
      {
        direction: "inbound",
        channel: "sms",
        body: "Hey Jeremy, quick one. We signed the lease on the Westfield space today!! Terrified and excited.",
        createdAt: "2026-06-17",
      },
    ],
  },

  "demo-marcus": {
    ghlContactId: "demo-marcus",
    name: "Marcus Lee",
    email: "marcus.lee@example.com",
    phone: "+13125550199",
    tags: ["referral", "quiet"],
    customFields: {
      business: "Lee & Co Accounting",
    },
    notes: [
      {
        body: "Marcus referred two clients last quarter and never asked for anything back. Generous guy. Father passed away in February; he's been heads-down since.",
        createdAt: "2026-03-05",
      },
    ],
    conversations: [
      {
        direction: "outbound",
        channel: "email",
        body: "Marcus, thinking of you this week. No agenda, just wanted you to know.",
        createdAt: "2026-02-20",
      },
      {
        direction: "inbound",
        channel: "email",
        body: "Appreciate you reaching out, Jeremy. It's been a hard stretch but I'm getting there. Coffee soon?",
        createdAt: "2026-06-15",
      },
    ],
  },
};

export function getDemoContact(id: string): ContactContext | null {
  return DEMO_CONTACTS[id] ?? null;
}

export function listDemoContacts(): ContactContext[] {
  return Object.values(DEMO_CONTACTS);
}
