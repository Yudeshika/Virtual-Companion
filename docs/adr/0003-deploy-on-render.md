# ADR-0003: Deploy the relay to Render

- Status: proposed
- Date: 2026-11-16

## Context

The relay currently runs on a developer's laptop. This means:
- It goes offline when the laptop is closed
- Friends cannot point their extensions at a stable URL
- The ngrok tunnel URL changes on every restart, requiring Twilio webhook updates each session

To share the extension with others, the relay needs to be publicly hosted at a stable, always-on URL.

## Decision

Deploy the relay as a web service on Render's free tier.

## Alternatives considered

**Railway.**
Similar free tier, good Node.js support. Free tier was recently changed to require a credit card and has a $5/month minimum. Render's free tier remains genuinely free for a single web service at low traffic.

**Fly.io.**
Excellent for containerised workloads. Requires a Dockerfile and more configuration than Render's auto-detected Node build. Overkill for a single Express server.

**Self-hosted VPS (Hetzner, DigitalOcean).**
Full control, stable, cheap (~€4/month). Requires SSH access, manual deployment, and ongoing maintenance. More than the project needs at this stage.

**Keeping ngrok.**
Stable ngrok domains are available on paid plans (~$8/month). This keeps the relay local but adds cost and still depends on the developer's laptop being on. Not suitable for sharing with friends.

## Consequences

**Gets easier:**
- One stable public URL for all users to point their extensions at
- No ngrok session management; Twilio webhook URL never needs updating
- `PUBLIC_BASE_URL` can be set once in Render's environment variables dashboard
- Zero-config deployment: Render detects Node.js, runs `npm run build:relay`, then `node relay/dist/server.js`

**Gets harder:**
- Render free tier spins the service down after 15 minutes of inactivity. The first request after a cold start takes ~30 seconds. This means the first WhatsApp message after a quiet period may time out before the relay responds — Twilio will retry, so the message is not lost, just delayed.
- All users share one Anthropic API key and quota. Rate limiting (Phase 2) is needed before opening to more than a handful of trusted friends.
- Env vars (ANTHROPIC_API_KEY, TWILIO_AUTH_TOKEN, RELAY_READ_SECRET) must be configured in the Render dashboard, not in a `.env` file.

**To watch:**
- Render free tier has a 750-hour/month limit per account. A single always-on service uses ~720 hours/month — leaves almost no room for a second service on the same account.
- If the relay is upgraded to a paid tier, cold starts disappear and the 750-hour cap no longer applies.
