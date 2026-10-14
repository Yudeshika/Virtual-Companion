import { keywordTriage } from "../../../shared/keyword-scorer";
import type { NormalisedNotification, TriageResult } from "../../../shared/types";

export interface Triager {
  triage(batch: NormalisedNotification[]): Promise<TriageResult[]>;
}

export const keywordTriager: Triager = {
  async triage(batch) {
    return batch.map(keywordTriage);
  },
};

export interface TriageServiceOptions {
  /** The LLM triager. If absent, every call uses the keyword scorer. */
  primary?: Triager;
  timeoutMs?: number;
  cacheSize?: number;
  onFallback?: (reason: string) => void;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Wraps the primary (LLM) triager with:
 *  - a cache keyed by notification id, so a re-poll never pays twice
 *  - a timeout
 *  - a fallback to the keyword scorer on any error, timeout, or missing/invalid result
 */
export function createTriageService(opts: TriageServiceOptions = {}): Triager {
  const { primary, timeoutMs = 8_000, cacheSize = 2_000, onFallback } = opts;
  const cache = new Map<string, TriageResult>();

  function remember(r: TriageResult) {
    cache.set(r.id, r);
    if (cache.size > cacheSize) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  return {
    async triage(batch) {
      const misses = batch.filter((n) => !cache.has(n.id));

      if (misses.length > 0) {
        let scored: TriageResult[] = [];
        if (primary) {
          try {
            scored = await withTimeout(primary.triage(misses), timeoutMs);
          } catch (err) {
            onFallback?.(err instanceof Error ? err.message : String(err));
            scored = [];
          }
        }
        const byId = new Map(scored.map((r) => [r.id, r]));
        for (const n of misses) {
          const r = byId.get(n.id);
          // Missing from the LLM response → keyword fallback for that item.
          // Keyword results aren't cached, so the LLM gets another go next poll.
          if (r) remember(r);
        }
        return batch.map((n) => cache.get(n.id) ?? byId.get(n.id) ?? keywordTriage(n));
      }

      return batch.map((n) => cache.get(n.id)!);
    },
  };
}
