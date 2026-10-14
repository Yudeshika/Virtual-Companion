import { describe, expect, it, vi } from "vitest";
import { createTriageService, type Triager } from "../relay/src/triage/service";
import type { NormalisedNotification, TriageResult } from "../shared/types";

const n = (id: string, title = "hello"): NormalisedNotification => ({
  id, source: "gmail", title, snippet: "", receivedAt: new Date().toISOString(),
});

const llmResult = (id: string, importance = 4): TriageResult => ({
  id, importance, category: "work", reason: "test", suggestedAction: "", scoredBy: "llm",
});

describe("triage service", () => {
  it("uses keywords when there is no LLM", async () => {
    const svc = createTriageService();
    const [r] = await svc.triage([n("a", "[P0] prod down")]);
    expect(r).toMatchObject({ importance: 9, scoredBy: "keyword" });
  });

  it("falls back to keywords when the LLM throws", async () => {
    const onFallback = vi.fn();
    const primary: Triager = { triage: async () => { throw new Error("boom"); } };
    const svc = createTriageService({ primary, onFallback });
    const [r] = await svc.triage([n("a")]);
    expect(r?.scoredBy).toBe("keyword");
    expect(onFallback).toHaveBeenCalledWith("boom");
  });

  it("falls back to keywords when the LLM times out", async () => {
    const primary: Triager = { triage: () => new Promise(() => {}) };
    const svc = createTriageService({ primary, timeoutMs: 20 });
    const [r] = await svc.triage([n("a")]);
    expect(r?.scoredBy).toBe("keyword");
  });

  it("falls back per item when the LLM skips one", async () => {
    const primary: Triager = { triage: async () => [llmResult("a")] };
    const svc = createTriageService({ primary });
    const results = await svc.triage([n("a"), n("b")]);
    expect(results.map((r) => r.scoredBy)).toEqual(["llm", "keyword"]);
  });

  it("ignores results for ids it didn't ask about", async () => {
    const primary: Triager = { triage: async () => [llmResult("invented", 10)] };
    const svc = createTriageService({ primary });
    const results = await svc.triage([n("a")]);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("a");
  });

  it("caches LLM results so a re-poll never pays twice", async () => {
    const triage = vi.fn(async (batch: NormalisedNotification[]) => batch.map((x) => llmResult(x.id)));
    const svc = createTriageService({ primary: { triage } });
    await svc.triage([n("a")]);
    await svc.triage([n("a")]);
    expect(triage).toHaveBeenCalledTimes(1);
  });
});
