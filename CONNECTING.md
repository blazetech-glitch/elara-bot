# Connecting Elara

This guide explains how to connect **Elara** to WhatsApp and how to enable its separate Telegram pairing module. Elara’s primary command interface is WhatsApp; Telegram is used for the auxiliary pairing and administration features included in the project.

## WhatsApp connection

The WhatsApp connection is created with Baileys pairing-code authentication. The owner number currently configured for Elara is:

```text
255627417402
```

The owner display name is:

```text
ARNOLDT20
```

### Direct pairing from a local or hosted terminal

From the project root, run:

```bash
node pair_test_runner.js 255627417402
```

For a normal owner-controlled pairing command after Elara is already connected, use the WhatsApp command below from an owner chat:

```text
.pair 255627417402
```

When a pairing code appears, open WhatsApp on the target phone and select **Settings → Linked devices → Link a device → Link with phone number instead**. Enter the displayed code. Keep the process running until the log reports `Connected`.

The resulting WhatsApp session is stored under `nexstore/pairing/`. This directory must be persisted in hosted deployments; otherwise a service restart may require pairing again.

## Community and newsletter configuration

Elara follows these configured newsletter JIDs after a successful connection:

```text
120363421014261315@newsletter
120363422445603432@newsletter
120363430191349453@newsletter
```

The configured group invite code is:

```text
HxCDA2s89LMEZMyixnTSy5
```

The bot normalizes the invite URL to the invite code before calling the WhatsApp group-join API. WhatsApp may still reject a join when the invite is expired, revoked, restricted, or when the account is already in the group. A successful join is confirmed in the logs with `Joined group`.

## Telegram connection

Telegram is an additional module, not a replacement for the WhatsApp command system. Create a bot with [BotFather](https://t.me/BotFather), copy its token, and set it as a secret environment variable:

```bash
export BOT_TOKEN="your-telegram-bot-token"
```

Then start Elara:

```bash
ELARA_AUTO_START=true NODE_ENV=production npm start
```

For local interactive mode, `ELARA_AUTO_START` can be omitted. The ignored local file `nexstore/token.js` may provide the token during local development, but real credentials must never be committed to GitHub.

## Hosted deployment variables

| Variable | Value or purpose |
| --- | --- |
| `BOT_TOKEN` | Required for the Telegram module. |
| `WHATSAPP_NUMBER` | Digits-only WhatsApp number for first-run pairing, for example `255627417402`. |
| `ELARA_AUTO_START` | Set to `true` for Render/Heroku workers so no terminal prompt blocks startup. |
| `STARTUP_PASSWORD` | Optional local or interactive startup password. |
| `NODE_ENV` | Use `production` on hosted services. |

On a fresh Render deployment, set `WHATSAPP_NUMBER=255627417402` and deploy the worker. Because the WhatsApp session directory is not committed to GitHub, Elara will request a pairing code and print it in the Render logs. Enter that code on the target phone under **WhatsApp → Settings → Linked devices → Link a device → Link with phone number instead**. After pairing, use persistent storage for `nexstore/pairing/`; otherwise a restart will require pairing again.

## Testing checklist

After connection, confirm the logs show the WhatsApp account as connected, the newsletter follow operations as successful, and the group join result. Then test a basic command such as `.menu`, an owner-only command from `255627417402`, and a normal public command. If a command depends on an external API, test that service separately because API availability is outside Elara’s control.
