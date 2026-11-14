# ADR-0002: Keep the keyword scorer as a fallback and eval baseline

- Status: accepted
- Date: 2026-10-20

## Context

The project started with a keyword scorer (`shared/keyword-scorer.ts`) that mapped words like "P0", "blocker" and "urgent" to fixed importance scores. It is simple, fast, free, and deterministic. The goal of this project is to replace it with an LLM triager that scores more accurately.

The question is what to do with the keyword scorer once the LLM triager exists:

- Remove it entirely
- Keep it only as an internal baseline for the eval
- Keep it as the live fallback when the LLM call fails

## Decision

Keep the keyword scorer as both the live fallback and the eval baseline. It is never called if the LLM succeeds; it is always called if the LLM times out, errors, or is not configured.

## Alternatives considered

**Remove the keyword scorer and fail hard.**
If the LLM is unavailable, return an error to the extension and let it decide. The problem is that the most important notifications — prod incidents, security alerts — are exactly the ones a user needs even when infrastructure is degraded. An LLM outage should not silence a "payments are down" alert. Failing hard violates the purpose of the tool.

**Use a fixed default score (e.g. importance 5) when the LLM fails.**
Simple, but loses all signal. A batch of 20 notifications all scoring 5 means the user has no basis to prioritise.

**Keep the keyword scorer only in the eval, not in production.**
This avoids adding complexity to the production path, but it means any LLM failure produces no output. The degraded-mode argument above applies.

## Consequences

**Gets easier:**
- The relay never fails silently: every notification gets a score, even during LLM outages or cold starts with no API key.
- The keyword scorer gives the eval a concrete baseline. Without it, there is no before/after story — just LLM numbers with nothing to compare against.
- Two scorers with different failure modes provide defence in depth: the LLM scores by semantics, keywords catch explicit signal words even if the LLM call never fires.

**Gets harder:**
- The keyword scorer is now a permanent resident of the codebase, not a thing to delete once the LLM ships. It needs to stay accurate enough to be a useful fallback.
- Per-item fallback (implemented in `service.ts`) means a batch response can mix `scoredBy: "llm"` and `scoredBy: "keyword"` items. The extension needs to handle both and ideally surface the difference to the user.

**To watch:**
- If the LLM keyword and scorer disagree significantly on a notification type, it is a signal that the keyword list needs updating — not that the fallback is broken.
- Latency budget: the keyword scorer is synchronous and sub-millisecond. The timeout in `service.ts` (default 8 s) is the only user-visible latency impact of the LLM path; the keyword path is free.
