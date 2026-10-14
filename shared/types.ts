// Types shared by the extension and the relay.

export const SOURCES = ["gmail", "linear", "jira", "sms", "whatsapp"] as const;
export type Source = (typeof SOURCES)[number];

/** A notification after the extension or relay has normalised it, before scoring. */
export interface NormalisedNotification {
  id: string;            // stable per source, e.g. "gmail_<messageId>"
  source: Source;
  title: string;         // untrusted: comes from the outside world
  snippet: string;       // untrusted
  from?: string;         // untrusted
  receivedAt: string;    // ISO timestamp
}

export const CATEGORIES = [
  "incident", "work", "personal", "finance", "security", "newsletter", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface TriageResult {
  id: string;
  importance: number;      // 1–10
  category: Category;
  reason: string;
  suggestedAction: string;
  scoredBy: "llm" | "keyword";
}

export interface ScoredNotification extends NormalisedNotification {
  importance: number;
  triage: TriageResult;
}
