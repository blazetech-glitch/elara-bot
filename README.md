<div align="center">

# Elara

### A graceful, feature-rich WhatsApp bot with a bold new identity

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://www.whatsapp.com/)
[![License](https://img.shields.io/badge/License-MIT-8B5CF6?style=for-the-badge)](LICENSE)
[![Repository](https://img.shields.io/badge/Repository-Private-EC4899?style=for-the-badge&logo=github&logoColor=white)](https://github.com/blazetech-glitch/elara-bot)

> **Elara** is a refreshed WhatsApp bot project that preserves the original command flow and file structure while bringing a softer, more distinctive visual identity to the experience.

</div>

---

## Overview

Elara is designed as a flexible, multi-feature WhatsApp bot with a broad command foundation, media utilities, pairing support, automated responses, and configurable community links. The project has been visually refined without changing its core execution flow.

| Area | Details |
| --- | --- |
| **Project name** | Elara |
| **Runtime** | Node.js 22 (Node.js 18 or newer supported) |
| **Entry point** | `index.js` |
| **Start command** | `npm start` |
| **Development command** | `npm run dev` |
| **License** | MIT |
| **Repository** | [Private GitHub repository](https://github.com/blazetech-glitch/elara-bot) |

## Highlights

Elara combines practical automation with an expressive presentation. Its project structure includes pairing and session support, command handling, media utilities, configuration files, database-backed settings, and a rotating image collection using the supplied Elara artwork.

### Visual identity

The bot now uses a coordinated Elara identity across visible bot labels, package metadata, sticker branding, README presentation, image assets, and active image URLs. The media directory retains compatible filenames while also including the complete supplied image set as `elara1.jpeg` through `elara8.jpeg`.

### Community configuration

The current newsletter and group settings are shown below.

| Setting | Current value |
| --- | --- |
| **Newsletter JID** | `120363421014261315@newsletter` |
| **WhatsApp group** | [Join the Elara community](https://chat.whatsapp.com/HxCDA2s89LMEZMyixnTSy5?s=cl&p=a&mlu=4) |
| **Additional JIDs** | Add them when supplied by the owner |

## Installation

Clone the private repository, enter the project directory, and install the dependencies.

```bash
git clone https://github.com/blazetech-glitch/elara-bot.git
cd elara-bot
npm install
```

## Configuration and credentials

Before starting Elara, provide the local authentication and bot-token files required by the existing project configuration. These files are intentionally excluded from version control through `.gitignore`.

```text
auth.json
nexstore/token.js
```

Do not commit authentication sessions, API tokens, passwords, or private keys. Keep secrets local or provide them through a secure deployment configuration.

## Deploying to Render or Heroku-style platforms

Elara now includes portable deployment files for hosted worker services. Both targets should run Elara as a **worker process**, not as a web dyno, because the bot maintains long-running messaging connections.

| Platform | Included file | Process type | Important consideration |
| --- | --- | --- | --- |
| **Render** | [`render.yaml`](render.yaml) | Background worker | Use persistent storage or an external session store for WhatsApp pairing data. |
| **Heroku-compatible** | [`Procfile`](Procfile) and [`app.json`](app.json) | Worker | The local filesystem is ephemeral, so session data must be restored externally after restarts. |

### Required hosted variables

Set these values in the platform’s secret/environment-variable dashboard. Do not place real tokens in `render.yaml`, `app.json`, or committed source files.

| Variable | Required | Purpose |
| --- | --- | --- |
| `BOT_TOKEN` | Yes | Telegram bot token used by the pairing service. |
| `ELARA_AUTO_START` | Yes for hosted workers | Set to `true` to bypass the interactive terminal password prompt. |
| `STARTUP_PASSWORD` | Optional | Startup password for local interactive mode or deployments that do not use automatic start. |
| `NODE_ENV` | Recommended | Set to `production`. |

### Render deployment

1. Create a new **Background Worker** from the private GitHub repository.
2. Select the repository branch containing `render.yaml`; Render can apply the service definition automatically.
3. Add `BOT_TOKEN` as a secret environment variable. Keep `ELARA_AUTO_START=true` and `NODE_ENV=production`.
4. Deploy and review the worker logs for the WhatsApp and Telegram initialization messages.

The free Render worker option may be unsuitable for a production WhatsApp connection if the service is stopped, restarted, or lacks durable storage. For reliable operation, use a plan and storage configuration that keeps the pairing directory available across restarts.

### Heroku-compatible deployment

Deploy the repository as a worker process and set the required configuration values:

```bash
heroku create elara-bot
heroku config:set BOT_TOKEN="your-telegram-token" ELARA_AUTO_START="true" NODE_ENV="production"
git push heroku master
heroku ps:scale worker=1
heroku logs --tail
```

The `Procfile` starts Elara with `npm start`, while `app.json` provides deploy-time metadata and variable descriptions. Heroku-style dynos do not provide durable local storage for WhatsApp authentication sessions, so use an external persistence strategy or re-pair after a dyno replacement.

### Local deployment fallback

For a local or persistent Linux server, keep `auth.json` and `nexstore/token.js` outside version control, install dependencies, and run the same worker command:

```bash
npm install
npm start
```

## Connection guide

For WhatsApp pairing, Telegram setup, newsletter verification, owner configuration, and hosted-session persistence, see [`CONNECTING.md`](CONNECTING.md).

## Running Elara

Start the bot with the standard command:

```bash
npm start
```

For development with automatic restarts, use:

```bash
npm run dev
```

The project also exposes the following direct entry commands:

| Command | Purpose |
| --- | --- |
| `npm start` | Starts the main bot process through `index.js` |
| `npm run dev` | Starts the development process with Nodemon |
| `npm run bot` | Starts the alternate bot entry through `bot.js` |
| `npm test` | Performs the existing JavaScript syntax check |

## Project layout

```text
.
├── allfunc/              Reusable functions and command utilities
├── database/             Runtime data and settings files
├── media/                Elara image assets and media resources
├── nexstore/             Store utilities and local runtime helpers
├── setting/              Bot configuration and visible branding
├── bot.js                Alternate bot entry point
├── case.js               Main command and message handling logic
├── index.js              Primary application entry point
├── package.json          Project metadata and dependencies
├── render.yaml           Render background-worker definition
├── Procfile              Heroku-compatible worker definition
├── app.json              Heroku-style deploy metadata
└── README.md             Project documentation
```

## Safety note

This repository contains bot source code and configuration structure, but private runtime credentials must remain outside version control. Review third-party API usage, rotate exposed credentials immediately, and follow the policies of WhatsApp and every connected service before deploying the bot.

## Contributing

Improvements are welcome when they preserve the project’s stability, respect the existing command flow, and avoid introducing private credentials. Please keep changes focused, document meaningful configuration updates, and test JavaScript syntax before opening a pull request.

## License

This project is distributed under the MIT License. See the [`LICENSE`](LICENSE) file when present in the repository.

<div align="center">

**Elara — soft identity, strong capability.**

</div>
