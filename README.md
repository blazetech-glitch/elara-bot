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
| **Runtime** | Node.js 18 or newer |
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
