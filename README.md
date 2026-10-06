# Webpage Summarizer

A Chrome extension that summarizes any webpage in one click using the OpenAI API, with a pay-once upgrade through Razorpay. I built and shipped it end to end: the extension, the AI integration, the payment flow and the backend that ties them together.

<!-- Add a screenshot: save it as docs/screenshot.png and uncomment the line below -->
<!-- ![Webpage Summarizer popup](docs/screenshot.png) -->

## What it does

- Reads the text of the page you're on and returns a short summary with key points.
- Gives every user a few free pages, then offers a one-time upgrade for 400 more.
- Verifies payments automatically: once Razorpay confirms a payment, the extension unlocks the extra pages the next time it opens.

## How it works

```
 Chrome extension                Backend (Node/Express)             External services
┌──────────────────┐   text    ┌────────────────────────┐  prompt  ┌──────────────┐
│ popup.js         │ ────────▶ │ POST /summarize        │ ───────▶ │ OpenAI API   │
│ - reads the tab  │ ◀──────── │ - holds the API key    │ ◀─────── │              │
│ - tracks usage   │  summary  │ - rate limits per IP   │          └──────────────┘
│                  │           │                        │  webhook ┌──────────────┐
│                  │  paid?    │ POST /webhook          │ ◀─────── │ Razorpay     │
│                  │ ────────▶ │ GET  /check-paid       │          └──────────────┘
└──────────────────┘           └────────────────────────┘
```

**Why a backend at all?** A Chrome extension's code can be downloaded and read by anyone who installs it, so an API key inside it is effectively public. All OpenAI calls go through the server, which keeps the key in an environment variable, caps input size and rate-limits requests so the endpoint can't be abused as a free proxy.

**Payment verification.** Razorpay calls `/webhook` after a successful payment. The server checks the HMAC-SHA256 signature against the webhook secret (using a constant-time comparison) before trusting the payload, then records the buyer's email. The extension asks `/check-paid` for that email when it opens.

## Project structure

```
extension/
  manifest.json   Manifest V3 config (activeTab + scripting, no blanket host access)
  popup.html      UI
  popup.js        Reads the page, calls the backend, tracks usage and upgrades
  background.js   Initialises usage counters on install
server/
  index.js        /summarize, /webhook and /check-paid endpoints
  .env.example    Required configuration
```

## Tech stack

JavaScript, Chrome Extensions (Manifest V3), Node.js, Express, OpenAI Chat Completions API, Razorpay payment links and webhooks.

## Running it locally

**Backend**

```bash
cd server
npm install
cp .env.example .env    # then fill in your own values
npm start
```

**Extension**

1. Set `API_BASE` and `PAYMENT_LINK` at the top of `extension/popup.js`.
2. Open `chrome://extensions`, turn on **Developer mode** and click **Load unpacked**.
3. Select the `extension` folder.

## Known limitations and next steps

This is a solo project, so I've been deliberate about what's production-ready and what isn't yet:

- **Paid status lives in memory** and resets when the server restarts. Next step: move it to a small database such as Postgres or Redis.
- **Usage limits are counted in the extension**, so a determined user could reset them. Next step: issue each install an ID and enforce limits on the server.
- **Payment is matched by email**, so anyone who knows a buyer's email could unlock pages. Next step: return a signed licence token after payment.
- **PDF support** was an early experiment with in-browser OCR that didn't work reliably, so I removed it. Next step: extract PDF text properly before summarizing.
