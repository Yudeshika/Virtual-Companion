# Local setup guide

## 1. Relay

```bash
cp relay/.env.example relay/.env
# Fill in ANTHROPIC_API_KEY, TWILIO_AUTH_TOKEN, RELAY_READ_SECRET
# Generate RELAY_READ_SECRET with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run dev:relay       # http://localhost:3000
curl localhost:3000/health   # should return {"ok":true}
```

## 2. Expose the relay publicly (for Twilio webhooks)

Twilio needs a public HTTPS URL to POST to. Use ngrok:

```bash
# One-time setup (free account required at dashboard.ngrok.com):
npx ngrok config add-authtoken YOUR_NGROK_TOKEN

# Each dev session — start this before starting the relay:
npx ngrok http 3000
# Copy the https://xxxx.ngrok-free.app URL — you'll need it for Twilio
```

Note: ngrok free tier gives a new URL on every restart. Update the Twilio webhook URL in the console each session, or upgrade to a paid ngrok plan for a stable domain.

## 3. Twilio

### Free trial
- Sign up at twilio.com (no credit card required)
- You get one free US phone number and ~$15 credit automatically
- **Restriction:** inbound SMS works from any number, but outbound SMS only goes to numbers you manually verify in the console — fine for testing with your own phone
- Messages are prefixed "Sent from your Twilio trial account" — not an issue for a demo

### Setup steps
1. twilio.com → Console → Phone Numbers → Manage → Buy a number
   - Filter by SMS capability
   - Trial accounts: pick the free trial number offered on signup
2. Copy **Auth Token** from Console → Account Info → paste into `relay/.env` as `TWILIO_AUTH_TOKEN`
3. Go to your phone number → Configure → Messaging Configuration:
   - **A message comes in** → Webhook → `https://xxxx.ngrok-free.app/webhook/sms`
   - HTTP method: POST
4. Text your Twilio number from a verified number
5. Check `curl -H "x-relay-secret: YOUR_SECRET" localhost:3000/messages`

### WhatsApp (optional, easier for demo)
Twilio Sandbox for WhatsApp doesn't require a paid number:
- Console → Messaging → Try it out → Send a WhatsApp message
- Follow the join instructions (send a code to the sandbox number)
- Set webhook to `https://xxxx.ngrok-free.app/webhook/whatsapp`

## 4. Chrome extension

```bash
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `extension/dist`
4. Click the extension icon → options:
   - Relay URL: `http://localhost:3000`
   - Relay secret: value of `RELAY_READ_SECRET` from `.env`
   - Add Gmail / Linear / Jira tokens as needed

## 5. Verify end to end

1. Start ngrok → copy URL → update Twilio webhook
2. Start relay: `npm run dev:relay`
3. Text your Twilio number (from a verified number on trial)
4. Open `chrome://extensions` → check the extension is active
5. The cat should react on the next poll (every 2 minutes, or reload the tab)
