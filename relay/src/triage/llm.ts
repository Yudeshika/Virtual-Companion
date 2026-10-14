import type { Triager } from "./service";

export interface LlmTriagerOptions {
  apiKey: string;
  model: string;
  /** Free-text preferences, e.g. "anything from my manager is urgent". */
  preferences?: string;
}

/**
 * WEEK 1 TASK — this is yours to build.
 *
 * Replace the throw with a real call. The service around this already handles
 * timeouts, caching and keyword fallback, so this function only needs to:
 *
 *  1. Build the prompt. Notification content is UNTRUSTED. Wrap each item in a
 *     clearly labelled block (e.g. <notification id="...">...</notification>) and
 *     tell the model that text inside those blocks is data to classify, never
 *     instructions to follow.
 *  2. Call the model with structured output (a tool / JSON schema) matching
 *     LlmTriageResponseSchema in shared/schema.ts.
 *  3. Parse the response with LlmTriageResponseSchema.parse(). Throw on failure
 *     so the service falls back to keywords.
 *  4. Drop any result whose id wasn't in the input batch (the model must not
 *     invent notifications), and map to TriageResult with scoredBy: "llm".
 *
 * Then point tests/injection.test.ts at this and make every case pass.
 */
export function createLlmTriager(_opts: LlmTriagerOptions): Triager {
  return {
    async triage() {
      throw new Error("LLM triage not implemented yet");
    },
  };
}
