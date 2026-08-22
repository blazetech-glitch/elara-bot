# Elara Privacy Policy

**Last updated: August 22, 2026**

This working privacy policy explains how **Elara**, maintained by **ARNOLDT20 (@StarboyT20)**, handles information when you use the Telegram bot, WhatsApp pairing flow, connected sessions, and related community features. It is written for this project’s current implementation and should be reviewed by a qualified privacy or legal professional before being used as a formal legal notice.

## Information Elara processes

When you interact with Elara on Telegram, Telegram provides the bot with the information required to receive and answer your request, such as your Telegram user ID, username when available, display name, chat ID, command text, and group or channel context. Elara uses this information to route replies, enforce required channel membership, recognize the configured owner, and maintain command-related records.

When you request WhatsApp pairing, Elara processes the phone number you submit, the pairing code returned by WhatsApp, and the Baileys authentication credentials required to maintain that WhatsApp connection. Pairing records are kept separate by session number. Telegram ownership metadata is used to show a user their own pair list and to protect owner-only controls.

Elara may also process content required for a requested command, including text, media, links, or a TikTok URL. Some media or technology commands rely on third-party services. Information sent to those services is limited to what is needed to complete the requested operation and is subject to the third party’s own policies.

## How information is used

Elara uses information to provide bot commands, create and monitor WhatsApp sessions, send requested replies or media, enforce membership requirements, publish configured technology updates, provide group welcome and goodbye messages, prevent unauthorized access to owner-only functions, and diagnose operational failures.

Elara does not sell personal information. Elara does not ask users to publish Telegram bot tokens, WhatsApp authentication credentials, or private pairing information in a public group or channel. Start WhatsApp pairing in a private Telegram chat.

## Storage and retention

The current deployment stores bot configuration, session metadata, ownership records, and WhatsApp authentication files in the application’s configured runtime storage. Hosted deployments may lose local session data when storage is not persistent, which can require a new pairing. Operational logs may contain technical errors and connection events. Information is retained only for as long as it is needed to operate, secure, troubleshoot, or maintain the requested connection, subject to the hosting environment’s retention behavior.

## Telegram and WhatsApp services

Telegram and WhatsApp process messages and account information under their own terms and privacy policies. Elara is not Telegram or WhatsApp and does not control their independent processing. To stop a Telegram connection, stop the bot deployment or remove the bot from the relevant chat. To stop a WhatsApp session, use Elara’s disconnect controls or remove the linked device from WhatsApp.

## Security responsibilities

Keep your Telegram bot token, WhatsApp pairing codes, session files, deployment secrets, and database credentials private. Do not share them in a group, channel, issue tracker, or public repository. No online system can guarantee absolute security, but Elara is designed to keep pairing sessions separated and to avoid exposing credentials through normal chat responses.

## Your requests

For privacy questions, correction requests, or deletion requests concerning this deployment, contact **ARNOLDT20 (@StarboyT20)**. Include enough information to identify the relevant Telegram account or WhatsApp session, but do not send passwords, bot tokens, or authentication files. Requests may require verification before action is taken.

## Policy changes

This policy may be updated when Elara’s data handling, integrations, hosting, or commands change. The latest project version should be treated as the current working policy.
