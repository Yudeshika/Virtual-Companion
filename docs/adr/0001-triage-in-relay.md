# ADR-0001: Run LLM triage in the relay, not the extension

- Status: accepted
- Date: 2026-10-20

## Context

Notifications arrive from two sources:

1. **Extension-side** (Gmail, Linear, Jira) — the Chrome service worker polls these APIs directly and already holds the normalised notification objects.
2. **Relay-side** (SMS, WhatsApp) — Twilio posts signed webhooks to the relay; the extension polls `/messages` to collect them.

Triage needs to call an external LLM API, which requires an API key. The question is where that call happens.

There are three options:
- Call the LLM from the extension (service worker)
- Call the LLM from the relay, behind the existing `/triage` endpoint
- Run triage on-device using a local model (WASM/WebLLM)

The relay already has a `/triage` endpoint added in the scaffold specifically to hold this decision open.

## Decision

Triage runs in the relay. The extension calls `POST /triage` with a batch of normalised notifications and receives scored results.

## Alternatives considered

**Call the LLM from the extension service worker.**
Technically possible — service workers can call external APIs. The problem is the API key. Chrome extension storage is accessible to any JavaScript running in the extension context, and extensions can be unpacked and inspected. Storing `ANTHROPIC_API_KEY` in `chrome.storage` or bundled in the extension source means anyone who installs the extension can read it. This is a standard API key exposure risk; Chrome's own extension security guidelines advise against embedding secrets in extension code.

**Local model (WebLLM / transformers.js).**
No API key needed, works offline, no latency cost. The tradeoff is model quality and bundle size — a model small enough to run in a browser tab (< ~500 MB) is significantly weaker at nuanced classification than a hosted Haiku-class model, and the bundle would inflate the extension size substantially. This would be the right call if privacy requirements demanded it, but for a portfolio project demonstrating LLM integration, it removes the interesting part.

## Consequences

**Gets easier:**
- The API key lives in a `.env` file on the server, never in browser storage.
- SMS and WhatsApp messages are already in the relay; triage can run before the extension polls, reducing perceived latency.
- The relay can cache triage results (implemented in `service.ts`) so a re-poll never pays twice.
- A single timeout and fallback path (`service.ts`) handles all error cases; nothing leaks into the extension.

**Gets harder:**
- The extension has a round-trip to the relay for every triage batch (~200–800 ms). For the keyword fallback path this round-trip is unnecessary overhead.
- The relay is a new operational dependency. If it is down, the extension falls back to its local keyword scorer — but that fallback has to be implemented and tested.

**To watch:**
- The relay must enforce `requireReadSecret` on `/triage` to prevent anyone who knows the relay URL from using your API quota. This is already in place via the `x-relay-secret` header check.
