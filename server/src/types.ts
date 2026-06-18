/**
 * Shared domain types for Manumation Snapshot.
 *
 * These describe the *relationship intelligence* the system produces —
 * not CRM activity. Every field exists to help the user remember a person.
 */

export type Channel = "sms" | "email" | "inbox";

export type MemoryType =
  | "family"
  | "personal"
  | "goals"
  | "wins"
  | "challenges"
  | "frustrations"
  | "hobbies"
  | "business"
  | "life_event";

export interface ExtractedMemory {
  type: MemoryType;
  /** A single, specific, human fact worth remembering. */
  content: string;
  /** 0-1. How confident the engine is this is real and durable. */
  confidence: number;
  /** Optional source quote that grounds this memory. */
  source?: string;
}

export interface RelationshipScores {
  /** Overall health of the relationship, 0-100. */
  relationshipHealth: number;
  /** How much trust has been built, 0-100. */
  trust: number;
  /** How human (vs transactional) the relationship feels, 0-100. */
  humanity: number;
  /** Net relationship deposits vs withdrawals, 0-100. */
  hundredCups: number;
  /** How actively engaged the contact is, 0-100. */
  engagement: number;
  /** How ripe the moment is for a meaningful conversation, 0-100. */
  nextBestConversation: number;
}

export type RelationshipStage =
  | "stranger"
  | "acquaintance"
  | "building"
  | "established"
  | "trusted"
  | "at_risk"
  | "dormant";

export interface Snapshot {
  scores: RelationshipScores;
  stage: RelationshipStage;
  /** The emotional/seasonal context the contact is living in right now. */
  currentSeason: string;
  /** The single best memory that defines why this relationship matters. */
  bestMemory: string;
  /** The last moment that actually mattered between them. */
  lastMeaningfulMoment: string;
  /** Things that would damage trust if said right now. */
  avoidSaying: string[];
  /** The hero output: the most meaningful conversation to have next. */
  nextBestConversation: string;
  /** One-line answer to "why does this person matter?" */
  whyTheyMatter: string;
}

export interface DraftReply {
  /** "warm" (Option 1) or "direct" (Option 2). */
  tone: "warm" | "direct";
  channel: Channel;
  text: string;
}

export interface HumanityGrade {
  specificity: number;
  authenticity: number;
  brevity: number;
  relationshipAccuracy: number;
  jeremyVoiceMatch: number;
  helpfulness: number;
  nonCreepiness: number;
  /** Weighted overall, 0-100. Replies below the threshold are rejected. */
  overall: number;
  /** Why it scored the way it did — shown to the user. */
  notes: string;
  /** Specific phrases the auditor flagged (e.g. "just checking in"). */
  flags: string[];
}

export interface GradedDraft extends DraftReply {
  grade: HumanityGrade;
  /** True if this reply was automatically rewritten to clear the threshold. */
  rewritten: boolean;
}

/** Normalized representation of everything we know from GHL about a contact. */
export interface ContactContext {
  ghlContactId: string;
  name: string;
  email?: string;
  phone?: string;
  tags: string[];
  notes: { body: string; createdAt?: string }[];
  conversations: {
    direction: "inbound" | "outbound";
    channel: Channel;
    body: string;
    createdAt?: string;
  }[];
  customFields: Record<string, string>;
}

/** The full result of processing one inbound message. */
export interface SnapshotResult {
  contactId: string;
  inboundMessage: string;
  snapshot: Snapshot;
  memories: ExtractedMemory[];
  drafts: GradedDraft[];
}
