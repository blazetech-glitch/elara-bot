# Elara Deployment and First-Start Connection

Elara supports two connection modes on panels, Render, Heroku-style workers, and Katabump-compatible Node.js panels.

## Start command

Use Node.js 18 or newer, install dependencies with `npm install`, and start the worker with:

```bash
npm start
```

The process is a long-running worker. The panel must keep the process alive and should provide persistent storage for `auth.json` and `nexstore/pairing/`; otherwise WhatsApp sessions may need to be paired again after a restart.

## Interactive first start

When the process has no provider configuration and the panel exposes an interactive console, Elara displays:

```text
1) WhatsApp — enter a phone number and receive a WhatsApp pairing code
2) Telegram — enter a Telegram bot token and verify the official channel
```

Choosing WhatsApp asks for a full phone number with country code, requests the Baileys pairing code, and continues into the normal WhatsApp command logic after the pairing flow starts. Choosing Telegram asks for the bot token without echoing it, validates the token with Telegram, verifies that `@elarapairgc` is reachable, and then starts normal Telegram polling. Regular Telegram users must join `@elarapairgc` before using commands; the configured owner/admin exemption remains in effect.

Interactive prompts are not available on most non-interactive hosted workers. For those deployments, set the provider and credential as environment variables instead.

## Environment variables

| Variable | Required when | Purpose |
| --- | --- | --- |
| `ELARA_PROVIDER` | Non-interactive deployments | `whatsapp`, `telegram`, or `both` |
| `WHATSAPP_NUMBER` | WhatsApp mode | Full WhatsApp number with country code, digits only or formatted digits |
| `BOT_TOKEN` | Telegram mode | Telegram bot token; store it as a panel secret and never commit it |
| `TELEGRAM_OFFICIAL_CHANNEL` | Optional | Official channel username; defaults to `@elarapairgc` |
| `STARTUP_PASSWORD` | Optional | Legacy interactive startup password when used by an existing installation |
| `ELARA_AUTO_START` | Optional | Enables hosted auto-start for existing deployments; provider credentials are still required for a fresh non-interactive deployment |

For WhatsApp-only deployment use `ELARA_PROVIDER=whatsapp` and `WHATSAPP_NUMBER`. For Telegram-only deployment use `ELARA_PROVIDER=telegram` and `BOT_TOKEN`. To load both existing services use `ELARA_PROVIDER=both` with the relevant credentials and sessions.

## Telegram requirements

Add `@Queenelara_bot` to `@elarapairgc` as an administrator if the bot should publish images and polls. Users are checked through Telegram membership status before command use. The bot token is never written to tracked source files.

## Katabump or generic panel setup

Create a Node.js service, select Node.js 18 or newer, set the start command to `npm start`, and add the variables above through the panel’s secret/environment-variable screen. For interactive first start, leave `ELARA_PROVIDER`, `WHATSAPP_NUMBER`, and `BOT_TOKEN` unset and open the panel console. For a worker that cannot accept console input, configure the provider and secret variables before starting. Enable persistent storage for the project directory when the panel offers it.

## Render and Heroku-style workers

Use the included `render.yaml`, `Procfile`, and `app.json` as worker configurations. Set `ELARA_PROVIDER` explicitly on non-interactive workers and add `WHATSAPP_NUMBER` and/or `BOT_TOKEN` through the host’s secret manager. Do not place real credentials in `render.yaml`, `app.json`, or GitHub.

## Render web panel

The included `render.yaml` now defines a web service rather than a worker. It serves the Elara Connect page on Render’s assigned `PORT` and keeps the WhatsApp/Telegram workers in the same process.

Set `ELARA_PANEL_MODE=true` and create a strong random `ELARA_PANEL_KEY` in Render’s secret environment settings. Open the Render service URL in a browser, enter the panel key, and choose either the WhatsApp or Telegram card. The WhatsApp card starts an isolated pairing session and polls for the code; the Telegram card validates the token and starts a separate Telegram worker. The panel never returns a Telegram token in its response.

The panel is intentionally protected by a shared access key because it controls live bot connections. Do not publish the URL and key together. For a multi-owner product with individual accounts, use the separate Elara Connect application rather than making this shared-key panel public.

The web service must have persistent storage for `auth.json` and `nexstore/pairing/`. Without persistent storage, a redeploy can require a new WhatsApp pairing. Render’s free worker/web-service limits and sleep behavior should be checked in the Render dashboard before using the service for continuous production traffic.
