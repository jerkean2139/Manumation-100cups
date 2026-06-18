// Mirror of the server domain types the UI consumes.

export type Channel = "sms" | "email" | "inbox";

export interface RelationshipScores {
  relationshipHealth: number;
  trust: number;
  humanity: number;
  hundredCups: number;
  engagement: number;
  nextBestConversation: number;
}

export interface Snapshot {
  scores: RelationshipScores;
  stage: string;
  currentSeason: string;
  bestMemory: string;
  lastMeaningfulMoment: string;
  avoidSaying: string[];
  nextBestConversation: string;
  whyTheyMatter: string;
}

export interface HumanityGrade {
  specificity: number;
  authenticity: number;
  brevity: number;
  relationshipAccuracy: number;
  jeremyVoiceMatch: number;
  helpfulness: number;
  nonCreepiness: number;
  overall: number;
  notes: string;
  flags: string[];
}

export interface GradedDraft {
  tone: "warm" | "direct";
  channel: Channel;
  text: string;
  grade: HumanityGrade;
  rewritten: boolean;
}

export interface ExtractedMemory {
  type: string;
  content: string;
  confidence: number;
  source?: string;
}

export interface SnapshotResult {
  contactId: string;
  inboundMessage: string;
  snapshot: Snapshot;
  memories: ExtractedMemory[];
  drafts: GradedDraft[];
}

export interface ContactSummary {
  id: string;
  name: string;
  email?: string;
  tags: string[];
}

export interface Settings {
  autoSms: boolean;
  autoEmail: boolean;
  autoInbox: boolean;
  autoVoicemail: boolean;
  humanityThreshold: number;
  senderName: string;
}
