// Fetchers for each source. Each returns normalised, *unscored* notifications.
// Scoring happens in one place (triage), so the LLM and the keyword baseline see the same input.

import type { NormalisedNotification } from "../../shared/types";

const now = () => new Date().toISOString();

export async function fetchGmail(token: string, seen: Set<string>): Promise<NormalisedNotification[]> {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread",
      { headers },
    );
    if (!listRes.ok) return [];
    const list = (await listRes.json()) as { messages?: { id: string }[] };

    const out: NormalisedNotification[] = [];
    for (const msg of (list.messages ?? []).slice(0, 5)) {
      const id = `gmail_${msg.id}`;
      if (seen.has(id)) continue;
      const detail = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(msg.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers },
      );
      if (!detail.ok) continue;
      const d = (await detail.json()) as {
        snippet?: string;
        payload?: { headers?: { name: string; value: string }[] };
      };
      const header = (name: string) => d.payload?.headers?.find((h) => h.name === name)?.value;
      const from = (header("From") ?? "").split("<")[0]?.trim() ?? "";
      out.push({
        id,
        source: "gmail",
        title: header("Subject") ?? "(no subject)",
        snippet: (d.snippet ?? "").slice(0, 300),
        from,
        receivedAt: now(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchLinear(token: string, seen: Set<string>): Promise<NormalisedNotification[]> {
  try {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{
          viewer {
            assignedIssues(filter: { state: { type: { nin: ["completed","cancelled"] } } }, first: 10) {
              nodes { id title priorityLabel description }
            }
          }
        }`,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { viewer?: { assignedIssues?: { nodes?: { id: string; title: string; priorityLabel: string; description?: string }[] } } };
    };
    const issues = data.data?.viewer?.assignedIssues?.nodes ?? [];
    return issues
      .filter((i) => !seen.has(`linear_${i.id}`))
      .map((i) => ({
        id: `linear_${i.id}`,
        source: "linear" as const,
        title: `[${i.priorityLabel}] ${i.title}`,
        snippet: (i.description ?? "").slice(0, 300),
        receivedAt: now(),
      }));
  } catch {
    return [];
  }
}

export async function fetchJira(token: string, domain: string, seen: Set<string>): Promise<NormalisedNotification[]> {
  try {
    if (!/^[a-z0-9-]+\.atlassian\.net$/i.test(domain)) return [];
    const jql = encodeURIComponent("assignee=currentUser() AND statusCategory!=Done ORDER BY updated DESC");
    const res = await fetch(`https://${domain}/rest/api/3/search?jql=${jql}&maxResults=10`, {
      headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      issues?: { id: string; key: string; fields: { summary: string; status?: { name: string }; priority?: { name: string } } }[];
    };
    return (data.issues ?? [])
      .filter((i) => !seen.has(`jira_${i.id}`))
      .map((i) => ({
        id: `jira_${i.id}`,
        source: "jira" as const,
        title: `${i.key}: ${i.fields.summary}`,
        snippet: `${i.fields.status?.name ?? ""} · ${i.fields.priority?.name ?? ""}`,
        receivedAt: now(),
      }));
  } catch {
    return [];
  }
}

/** SMS and WhatsApp, queued by the Twilio relay. */
export async function fetchRelay(
  relayUrl: string,
  secret: string,
  since: string | null,
  seen: Set<string>,
): Promise<NormalisedNotification[]> {
  try {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    const res = await fetch(`${relayUrl}/messages${qs}`, { headers: { "x-relay-secret": secret } });
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: NormalisedNotification[] };
    const fresh = (data.messages ?? []).filter((m) => !seen.has(m.id));

    if (fresh.length > 0) {
      // Clear what we've picked up. Fire-and-forget.
      fetch(`${relayUrl}/messages`, {
        method: "DELETE",
        headers: { "x-relay-secret": secret, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fresh.map((m) => m.id) }),
      }).catch(() => {});
    }
    return fresh.map(({ id, source, title, snippet, from, receivedAt }) => ({ id, source, title, snippet, from, receivedAt }));
  } catch {
    return [];
  }
}
