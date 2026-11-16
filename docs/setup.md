# Local setup guide

## 1. Relay

```bash
cp relay/.env.example relay/.env
# Fill in the required values (see below)
# Generate RELAY_READ_SECRET with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

PORT=3001 npm run dev:relay       # http://localhost:3001
curl localhost:3001/health        # should return {"ok":true}
```

**Required env vars:**

| Var | Description |
|-----|-------------|
| `TWILIO_AUTH_TOKEN` | From Twilio Console → Account Info. Click the eye icon to reveal before copying. |
| `RELAY_READ_SECRET` | Random hex string you generate. Used by the extension to authenticate. |
| `ANTHROPIC_API_KEY` | From console.anthropic.com → API Keys. Leave unset for keyword-only mode. |

**Optional env vars:**

| Var | Description |
|-----|-------------|
| `TRIAGE_MODEL` | Defaults to `claude-haiku-4-5-20251001`. Override for a different model. |
| `TRIAGE_PREFERENCES` | Free-text triage preferences, e.g. `Anything from my manager is urgent. Newsletters are noise.` |
| `PUBLIC_BASE_URL` | Your public ngrok/Render URL. Required for Twilio signature validation to work correctly. |
| `PORT` | Defaults to 3000. Set to 3001 if another service is on 3000 (e.g. Langfuse). |

**Fallback behaviour:** if the relay is unreachable or the LLM call fails, the extension falls back to the local keyword scorer automatically — notifications are always scored, never silently dropped.

## 2. Expose the relay publicly (for Twilio webhooks)

Twilio needs a public HTTPS URL to POST to. Use ngrok:

```bash
# One-time setup (free account required at dashboard.ngrok.com):
npx ngrok config add-authtoken YOUR_NGROK_TOKEN

# Each dev session — start this before starting the relay:
npx ngrok http http://localhost:3001 --url https://YOUR-STABLE-URL.ngrok-free.app
# Copy the https://... URL — you'll need it for Twilio and PUBLIC_BASE_URL
```

Add the ngrok URL to `relay/.env`:
```
PUBLIC_BASE_URL=https://YOUR-STABLE-URL.ngrok-free.app
```

Note: ngrok free tier gives a new URL on every restart unless you use a reserved domain (paid). Update the Twilio webhook URL and `PUBLIC_BASE_URL` each session if the URL changes.

## 3. Twilio

### Free trial
- Sign up at twilio.com (no credit card required)
- You get one free US phone number and ~$15 credit automatically
- **Restriction:** inbound SMS works from any number, but outbound SMS only goes to numbers you manually verify in the console
- Messages are prefixed "Sent from your Twilio trial account" — not an issue for a demo

### WhatsApp sandbox setup (recommended — no paid number needed)
1. Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Send `join twilio-trial` from your WhatsApp to **+44 7460 041934** (or whichever sandbox number Twilio shows)
3. Go to **Sandbox settings** tab → **Sandbox Configuration**:
   - **When a message comes in** → `https://YOUR-NGROK-URL/webhook/whatsapp` → HTTP POST
   - **Status callback URL** → leave empty
   - Click **Save**
4. Copy **Auth Token** from Console → Account Info (click eye icon to reveal) → paste into `relay/.env` as `TWILIO_AUTH_TOKEN`

### Verify Twilio is working
Send a WhatsApp message to the sandbox number, then:
```bash
curl -H "x-relay-secret: YOUR_RELAY_READ_SECRET" http://localhost:3001/messages
```
You should see your message in the response JSON.

## 4. Chrome extension

```bash
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `extension/dist`
4. Click the extension icon → options:
   - **Relay URL:** `http://localhost:3001`
   - **Relay secret:** value of `RELAY_READ_SECRET` from `.env`
   - Add Gmail / Linear / Jira tokens as needed

**Gmail token** (expires after 1 hour):
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Scope: `https://www.googleapis.com/auth/gmail.readonly`
3. Authorise → Exchange code for tokens → copy **Access Token**
4. Paste into the extension options

## 5. Verify end to end

1. Start relay: `PORT=3001 npm run dev:relay`
2. Start ngrok: `npx ngrok http http://localhost:3001 --url https://YOUR-URL.ngrok-free.app`
3. Update Twilio webhook to the ngrok URL (if changed)
4. Send a WhatsApp message to the sandbox number
5. Check curl shows the message: `curl -H "x-relay-secret: ..." http://localhost:3001/messages`
6. Open any browser tab — the cat should react on the next poll (every 2 minutes)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `403 Forbidden` on `/webhook/whatsapp` | Wrong TWILIO_AUTH_TOKEN (copied while masked) | Reveal the token with the eye icon in Twilio Console, copy again, restart relay |
| `403 Forbidden` persists after fixing token | `PUBLIC_BASE_URL` missing or wrong | Add `PUBLIC_BASE_URL=https://your-ngrok-url` to `.env`, restart relay |
| `Missing required env var TWILIO_AUTH_TOKEN` | Relay not loading `.env` | Always start with `npm run dev:relay` (not `tsx` directly) |
| ngrok returns `404 Not Found` from Langfuse | ngrok tunnelling to wrong port | Run `npx ngrok http http://localhost:3001` |
| `{"messages":[],"count":0}` after sending WhatsApp | Sandbox session expired | Resend `join twilio-trial` to the sandbox number |
| `{"error":"Unauthorized"}` on curl | Wrong relay secret | Check exact value of `RELAY_READ_SECRET` in `.env` (no quotes, no spaces) |
