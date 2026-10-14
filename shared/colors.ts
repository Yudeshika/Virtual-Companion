import type { Source } from "./types";

// Colours come from this fixed map, never from notification data,
// so untrusted input can't inject CSS.
export const SOURCE_COLORS: Record<Source, string> = {
  gmail: "#e74c3c",
  linear: "#7c3aed",
  jira: "#0052cc",
  sms: "#0088cc",
  whatsapp: "#25d366",
};
