// The original keyword scorers, kept exactly as they were.
// They are the fallback when the LLM fails, and the baseline in the eval.

import type { NormalisedNotification, TriageResult } from "./types";

const WORK_CRITICAL = ["p0", "blocker", "critical", "prod down", "urgent", "overdue", "invoice", "password reset", "verify", "alert"];
const WORK_HIGH = ["p1", "important", "deadline", "failing", "error", "blocked", "review requested", "meeting"];
const WORK_MEDIUM = ["p2", "reminder", "updated", "assigned", "mentioned", "commented"];

/** Original `scoreItem()` from background.js (Gmail, Linear, Jira). */
export function scoreWorkItem(text: string): number {
  const t = text.toLowerCase();
  if (WORK_CRITICAL.some((k) => t.includes(k))) return 9;
  if (WORK_HIGH.some((k) => t.includes(k))) return 7;
  if (WORK_MEDIUM.some((k) => t.includes(k))) return 5;
  return 2;
}

const MSG_URGENT = ["urgent", "help", "emergency", "call me", "asap", "important", "problem", "broken", "down", "failed"];
const MSG_MID = ["reminder", "update", "question", "meeting", "when", "can you", "tonight", "tomorrow"];

/** Original `scoreMessage()` from the relay (SMS, WhatsApp). */
export function scoreMessage(text: string): number {
  const t = text.toLowerCase();
  if (MSG_URGENT.some((k) => t.includes(k))) return 8;
  if (MSG_MID.some((k) => t.includes(k))) return 5;
  return 3;
}

export function keywordScore(n: NormalisedNotification): number {
  const text = `${n.title} ${n.snippet}`;
  return n.source === "sms" || n.source === "whatsapp" ? scoreMessage(text) : scoreWorkItem(text);
}

export function keywordTriage(n: NormalisedNotification): TriageResult {
  return {
    id: n.id,
    importance: keywordScore(n),
    category: "other",
    reason: "keyword match",
    suggestedAction: "",
    scoredBy: "keyword",
  };
}
