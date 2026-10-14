export interface Settings {
  gmailToken: string;
  linearToken: string;
  jiraToken: string;   // base64("email:api_token")
  jiraDomain: string;
  relayUrl: string;    // e.g. https://virtual-companion-relay.onrender.com
  relaySecret: string;
  threshold: number;
  sources: { gmail: boolean; linear: boolean; jira: boolean; relay: boolean };
  seenIds: string[];
  lastRelayPoll: string | null;
}

export const DEFAULT_THRESHOLD = 6;

const DEFAULTS: Settings = {
  gmailToken: "",
  linearToken: "",
  jiraToken: "",
  jiraDomain: "",
  relayUrl: "",
  relaySecret: "",
  threshold: DEFAULT_THRESHOLD,
  sources: { gmail: true, linear: true, jira: true, relay: true },
  seenIds: [],
  lastRelayPoll: null,
};

export async function getSettings(): Promise<Settings> {
  const keys = Object.keys(DEFAULTS) as (keyof Settings)[];
  const stored: Partial<Settings> = await chrome.storage.local.get<Partial<Settings>>(keys);
  return {
    ...DEFAULTS,
    ...stored,
    sources: { ...DEFAULTS.sources, ...(stored.sources ?? {}) },
  };
}

/** Only https, or http on localhost for development. */
export function isAllowedRelayUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}
