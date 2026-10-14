import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import twilio from "twilio";
import { scoreMessage } from "../../shared/keyword-scorer";
import { TriageRequestSchema } from "../../shared/schema";
import type { NormalisedNotification } from "../../shared/types";
import { safeEqual } from "./auth";
import type { Triager } from "./triage/service";

export interface RelayConfig {
  twilioAuthToken: string;
  readSecret: string;
  triager: Triager;
  /** Public base URL Twilio posts to, e.g. https://virtual-companion-relay.onrender.com. Used for signature checks. */
  publicBaseUrl?: string;
  maxMessages?: number;
}

/** A queued SMS/WhatsApp message waiting for the extension to pick it up. */
export interface QueuedMessage extends NormalisedNotification {
  importance: number;
}

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

export function createApp(config: RelayConfig) {
  const { twilioAuthToken, readSecret, triager, publicBaseUrl, maxMessages = 50 } = config;
  let messages: QueuedMessage[] = [];

  const app = express();
  // Render/Railway/Fly sit behind a proxy. Without this, req.protocol is "http"
  // and every Twilio signature check fails.
  app.set("trust proxy", true);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || origin.startsWith("chrome-extension://")) cb(null, true);
        else cb(new Error("Not allowed by CORS"));
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));
  app.use(express.json({ limit: "256kb" }));

  function requireTwilioSignature(req: Request, res: Response, next: NextFunction) {
    const signature = req.get("x-twilio-signature") ?? "";
    const base = publicBaseUrl ?? `${req.protocol}://${req.get("host")}`;
    const url = `${base}${req.originalUrl}`;
    if (!twilio.validateRequest(twilioAuthToken, signature, url, req.body ?? {})) {
      res.status(403).send("Forbidden");
      return;
    }
    next();
  }

  function requireReadSecret(req: Request, res: Response, next: NextFunction) {
    if (!safeEqual(req.get("x-relay-secret") ?? "", readSecret)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  }

  function store(msg: QueuedMessage) {
    messages.unshift(msg);
    if (messages.length > maxMessages) messages = messages.slice(0, maxMessages);
  }

  const newId = (prefix: string) => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  app.post("/webhook/sms", requireTwilioSignature, (req, res) => {
    const from = String(req.body.From ?? "");
    const body = String(req.body.Body ?? "");
    store({
      id: newId("sms"),
      source: "sms",
      from,
      title: `SMS from ${formatNumber(from)}`,
      snippet: body.slice(0, 500),
      receivedAt: new Date().toISOString(),
      importance: scoreMessage(body),
    });
    res.type("text/xml").send(EMPTY_TWIML);
  });

  app.post("/webhook/whatsapp", requireTwilioSignature, (req, res) => {
    const from = String(req.body.From ?? "").replace("whatsapp:", "");
    const body = String(req.body.Body ?? "");
    const profileName = String(req.body.ProfileName ?? from);
    const numMedia = Number.parseInt(String(req.body.NumMedia ?? "0"), 10) || 0;
    store({
      id: newId("wa"),
      source: "whatsapp",
      from,
      title: profileName,
      snippet: body.slice(0, 500) || (numMedia > 0 ? "[media]" : ""),
      receivedAt: new Date().toISOString(),
      importance: scoreMessage(`${body} ${profileName}`),
    });
    res.type("text/xml").send(EMPTY_TWIML);
  });

  app.get("/messages", requireReadSecret, (req, res) => {
    const since = typeof req.query.since === "string" ? new Date(req.query.since) : null;
    const result = since && !Number.isNaN(since.getTime())
      ? messages.filter((m) => new Date(m.receivedAt) > since)
      : messages;
    res.json({ messages: result, count: result.length });
  });

  app.delete("/messages", requireReadSecret, (req, res) => {
    const ids: unknown = req.body?.ids;
    if (Array.isArray(ids) && ids.length > 0) {
      const drop = new Set(ids.map(String));
      messages = messages.filter((m) => !drop.has(m.id));
    } else {
      messages = [];
    }
    res.json({ ok: true, remaining: messages.length });
  });

  app.post("/triage", requireReadSecret, async (req, res) => {
    const parsed = TriageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
      return;
    }
    const results = await triager.triage(parsed.data.notifications);
    res.json({ results });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

function formatNumber(raw: string): string {
  return raw.replace(/(\+\d{2})(\d{4})(\d{6})/, "$1 $2 $3");
}
