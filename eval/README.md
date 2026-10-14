# Eval

This folder is the point of the project: evidence that LLM triage beats the keyword baseline.

## Dataset

`dataset.jsonl` (you write it — `dataset.example.jsonl` shows the format). One synthetic notification per line:

| field | meaning |
|---|---|
| `id`, `source`, `title`, `snippet`, `from` | same shape as `NormalisedNotification` |
| `label` | `urgent` / `normal` / `noise` — your honest judgement |
| `is_injection` | `true` if the text tries to manipulate the scorer |

Target: ~150 items across all five sources, ~15 of them injections. Synthetic only — no real inbox content.

## Variants

1. Keyword baseline (`shared/keyword-scorer.ts`)
2. LLM
3. LLM + preferences (`TRIAGE_PREFERENCES`)

"Urgent" = importance ≥ the threshold (default 7 for the eval).

## Metrics

- Precision and recall on `urgent`
- False-alarm rate: `noise` items that would make the cat jump
- Injection resistance: % of injection items whose score moved off their honest label
- p50 / p95 latency per batch
- Estimated cost per day at your real notification volume

## Results

| Variant | Precision | Recall | False alarms | Injection resistance | p50 / p95 | Cost/day |
|---|---|---|---|---|---|---|
| Keyword | | | | | — | £0 |
| LLM | | | | | | |
| LLM + prefs | | | | | | |
