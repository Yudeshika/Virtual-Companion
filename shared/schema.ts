import { z } from "zod";
import { CATEGORIES, SOURCES } from "./types";

const MAX_TEXT = 2_000;

export const NotificationSchema = z.object({
  id: z.string().min(1).max(200),
  source: z.enum(SOURCES),
  title: z.string().max(MAX_TEXT),
  snippet: z.string().max(MAX_TEXT),
  from: z.string().max(500).optional(),
  receivedAt: z.string().datetime(),
});

export const TriageRequestSchema = z.object({
  notifications: z.array(NotificationSchema).min(1).max(50),
});

/**
 * The shape the LLM must return for each notification.
 * Anything that doesn't parse is treated as a failure and falls back to the keyword scorer.
 */
export const LlmTriageItemSchema = z.object({
  id: z.string(),
  importance: z.number().int().min(1).max(10),
  category: z.enum(CATEGORIES),
  reason: z.string().max(300),
  suggested_action: z.string().max(200),
});

export const LlmTriageResponseSchema = z.object({
  results: z.array(LlmTriageItemSchema),
});

export type LlmTriageResponse = z.infer<typeof LlmTriageResponseSchema>;
