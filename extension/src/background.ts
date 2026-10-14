// Service worker: polls sources on an alarm, sends everything to the relay for
// triage, and broadcasts the important ones to every tab's cat.

import { keywordTriage } from "../../shared/keyword-scorer";
import type { NormalisedNotification, ScoredNotification, TriageResult } from "../../shared/types";
import { getSettings, isAllowedRelayUrl, type Settings } from "./settings";
import { fetchGmail, fetchJira, fetchLinear, fetchRelay } from "./sources";

const POLL_INTERVAL_MINUTES = 2;
const MAX_SEEN = 500;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("pollSources", { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollSources") void pollAllSources();
});

chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg?.type === "POLL_NOW") void pollAllSources();
});

/**
 * Triage happens in the relay so the API key never lives in the extension.
 * If the relay isn't configured or doesn't answer, score locally with keywords.
 */
async function triage(s: Settings, batch: NormalisedNotification[]): Promise<TriageResult[]> {
  if (s.relayUrl && s.relaySecret && isAllowedRelayUrl(s.relayUrl)) {
    try {
      const res = await fetch(`${s.relayUrl}/triage`, {
        method: "POST",
        headers: { "x-relay-secret": s.relaySecret, "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: batch }),
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: TriageResult[] };
        const byId = new Map((data.results ?? []).map((r) => [r.id, r]));
        return batch.map((n) => byId.get(n.id) ?? keywordTriage(n));
      }
    } catch {
      // fall through to local keywords
    }
  }
  return batch.map(keywordTriage);
}

async function pollAllSources(): Promise<void> {
  const s = await getSettings();
  const seen = new Set(s.seenIds);
  const pollStartedAt = new Date().toISOString();

  const jobs: Promise<NormalisedNotification[]>[] = [];
  if (s.sources.gmail && s.gmailToken) jobs.push(fetchGmail(s.gmailToken, seen));
  if (s.sources.linear && s.linearToken) jobs.push(fetchLinear(s.linearToken, seen));
  if (s.sources.jira && s.jiraToken && s.jiraDomain) jobs.push(fetchJira(s.jiraToken, s.jiraDomain, seen));
  if (s.sources.relay && s.relayUrl && s.relaySecret && isAllowedRelayUrl(s.relayUrl)) {
    jobs.push(fetchRelay(s.relayUrl, s.relaySecret, s.lastRelayPoll, seen));
  }

  const fetched = (await Promise.all(jobs)).flat();
  await chrome.storage.local.set({ lastRelayPoll: pollStartedAt });
  if (fetched.length === 0) return;

  const results = await triage(s, fetched.slice(0, 50));
  const byId = new Map(results.map((r) => [r.id, r]));
  const scored: ScoredNotification[] = fetched.slice(0, 50).map((n) => {
    const t = byId.get(n.id) ?? keywordTriage(n);
    return { ...n, importance: t.importance, triage: t };
  });

  // Mark everything we scored as seen — not just the important ones —
  // so the same notification is never sent for triage twice.
  const newSeen = [...s.seenIds, ...scored.map((n) => n.id)].slice(-MAX_SEEN);
  await chrome.storage.local.set({ seenIds: newSeen });

  const important = scored
    .filter((n) => n.importance >= s.threshold)
    .sort((a, b) => b.importance - a.importance);
  if (important.length === 0) return;

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    // Tabs without the content script (chrome://, web store) reject; ignore them.
    chrome.tabs.sendMessage(tab.id, { type: "NEW_NOTIFICATIONS", notifications: important }).catch(() => {});
  }
}
