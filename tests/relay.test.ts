import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../relay/src/app";
import { safeEqual } from "../relay/src/auth";
import { keywordTriager } from "../relay/src/triage/service";

const SECRET = "test-secret";
const app = createApp({ twilioAuthToken: "twilio-token", readSecret: SECRET, triager: keywordTriager });

describe("relay", () => {
  it("compares secrets safely, including different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "abc")).toBe(false);
  });

  it("rejects /messages without the secret", async () => {
    await request(app).get("/messages").expect(401);
    await request(app).get("/messages").set("x-relay-secret", "wrong").expect(401);
  });

  it("serves /messages with the secret", async () => {
    const res = await request(app).get("/messages").set("x-relay-secret", SECRET).expect(200);
    expect(res.body).toEqual({ messages: [], count: 0 });
  });

  it("rejects Twilio webhooks with a bad signature", async () => {
    await request(app)
      .post("/webhook/sms")
      .set("x-twilio-signature", "forged")
      .type("form")
      .send({ From: "+447900000000", Body: "hi" })
      .expect(403);
  });

  it("triages a batch", async () => {
    const res = await request(app)
      .post("/triage")
      .set("x-relay-secret", SECRET)
      .send({
        notifications: [
          { id: "gmail_1", source: "gmail", title: "Invoice overdue", snippet: "", receivedAt: new Date().toISOString() },
        ],
      })
      .expect(200);
    expect(res.body.results[0]).toMatchObject({ id: "gmail_1", importance: 9, scoredBy: "keyword" });
  });

  it("rejects malformed triage requests", async () => {
    await request(app).post("/triage").set("x-relay-secret", SECRET).send({ notifications: [] }).expect(400);
    await request(app).post("/triage").set("x-relay-secret", SECRET).send({ nope: true }).expect(400);
  });
});
