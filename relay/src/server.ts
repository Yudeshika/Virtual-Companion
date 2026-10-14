import "dotenv/config";
import { createApp } from "./app";
import { createLlmTriager } from "./triage/llm";
import { createTriageService } from "./triage/service";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}. See relay/.env.example.`);
    process.exit(1);
  }
  return v;
}

const apiKey = process.env.ANTHROPIC_API_KEY;

const triager = createTriageService({
  primary: apiKey
    ? createLlmTriager({
        apiKey,
        model: process.env.TRIAGE_MODEL ?? "claude-haiku-5-5",
        preferences: process.env.TRIAGE_PREFERENCES,
      })
    : undefined,
  timeoutMs: Number(process.env.TRIAGE_TIMEOUT_MS ?? 8000),
  onFallback: (reason) => console.warn(`triage fell back to keywords: ${reason}`),
});

const app = createApp({
  twilioAuthToken: required("TWILIO_AUTH_TOKEN"),
  readSecret: required("RELAY_READ_SECRET"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL,
  triager,
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`virtual-companion relay listening on :${port} (triage: ${apiKey ? "llm + keyword fallback" : "keyword only"})`);
});
