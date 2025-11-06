# South Florida Roleplay Discord Bot (Python)

Production-ready Python Discord bot for South Florida Roleplay. Includes ticket management (panel, open, claim/unclaim, rename, close with transcripts) and session utilities (start, full, shutdown, boost, poll with vote tracking). Ticket-related images are simplified; session commands support per-command image URLs.

## Requirements

- Python: 3.10+ (3.11 recommended)
- `pip` for dependency management
- Discord Bot token with privileged intents configured
- Recommended Python libraries (installed via `requirements.txt`):
  - `discord.py`
  - `python-dotenv`
  - `aiohttp`

## Installation

1. Install Python 3.10+.
   - Windows: https://www.python.org/downloads/
   - Verify: `python --version` prints `3.10+`
2. Clone or copy this repository.
3. (Optional) Create and activate a virtual environment:
   - `python -m venv .venv`
   - Windows: `.venv\Scripts\activate`
4. Install dependencies:
   - `pip install -r requirements.txt`
5. Create a `.env` file at the project root with required keys.

## Configuration (.env)

Put these variables in a `.env` file. All IDs are Discord snowflakes.

```
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=123456789012345678
TICKET_PANEL_CHANNEL_ID=123456789012345678
TICKET_CATEGORY_ID=123456789012345678
AUTO_ROLE_1_ID=0
AUTO_ROLE_2_ID=0
COUNTER_EMOJI_SPEC=🔢
LINK_EMOJI_SPEC=🔗
LINK_LABEL=Server Link
LINK_URL=https://discord.gg/example
COUNT_HUMANS_ONLY=true

SESSIONS_STAFF_ROLE_ID=0
SESSIONS_PING_ROLE_ID=0
SESSIONS_POLL_CAPACITY_DEFAULT=5
SESSIONS_SERVER_NAME=South Florida Roleplay
SESSIONS_SERVER_CODE=sflrp
SESSIONS_SERVER_OWNER=South Florida Roleplay
SESSIONS_JOIN_URL=https://www.roblox.com/games/2534724415/South-Florida-Roleplay
UNKNOWN_ROLE_ID=0

ENABLE_HTML_TRANSCRIPTS=true
AUTO_POST_PANEL_ON_START=true
PANEL_HISTORY_SCAN_LIMIT=50
MAX_OPEN_TICKETS_PER_USER=2
TOPIC_OPENER_TAG_KEY=OPENER

# Colors (hex without leading #)
TICKET_EMBED_COLOR=2B2D31
SESSIONS_EMBED_COLOR=5865F2

# Ticket images (only these two are kept)
PANEL_EMBED_IMAGE=https://example.com/panel.png
AUTHOR_EMBED_IMAGE=https://example.com/author.png

# Per-session command images
SESSIONS_START_IMAGE_URL=https://example.com/sessions_start.png
SESSIONS_SHUTDOWN_IMAGE_URL=https://example.com/sessions_shutdown.png
SESSIONS_FULL_IMAGE_URL=https://example.com/sessions_full.png
SESSIONS_BOOST_IMAGE_URL=https://example.com/sessions_boost.png
SESSIONS_POLL_IMAGE_URL=https://example.com/sessions_poll.png

# Session Status Panel
SESSION_STATUS_CHANNEL_ID=123456789012345678
SESSION_STATUS_IMAGE_1_URL=https://example.com/session_status_1.png
SESSION_STATUS_IMAGE_2_URL=https://example.com/session_status_2.png
SESSION_STATUS_IMAGE_3_URL=https://example.com/session_status_3.png
SESSION_STATUS_POLL_INTERVAL_MS=60000

# Session Status Panel Emojis (override defaults as needed)
# Values can be unicode or full custom emoji mentions (<:name:id> or <a:name:id>)
EPHEMERAL_EMOJI_INFO=ℹ️
ERLC_EMOJI_PLAYERS=👥
ERLC_EMOJI_MODERATOR=🛡️
ERLC_EMOJI_QUEUE=⏳
```

## Overview
This is a Discord bot for South Florida Roleplay. It provides dashboard/ticket panels, session management, ER:LC integrations, and multiple utility commands.

## Setup
- Install dependencies: `npm install`
- Configure environment: copy `.env` and fill in required values
- Start the bot: `npm start`

## Deploy to Render

Use the included `render.yaml` to deploy as a background worker.

- Push the repo to GitHub. Ensure `.env` is NOT committed (top-level `.gitignore` ignores it).
- In Render, click “New +” → “Blueprint” and select your GitHub repo.
- Render will detect `render.yaml` and create a Node worker named `sflrp-bot`.
- Set required environment variables in Render:
  - `DISCORD_TOKEN` (required)
  - `MONGO_URI` and `MONGO_DB_NAME` (required if Mongo features are used)
  - `PRC_KEY` (required for ER:LC integrations)
  - `PREFIX_REQUIRED_ROLE_ID` and any channel IDs you use (optional)
- Build command: `npm install` (defined in `render.yaml`)
- Start command: `node index.js` (defined in `render.yaml`)

Notes:
- This bot is a background process (Discord gateway), so a Render “Worker” is the correct type, not a web service.
- For local development, copy `.env.example` to `.env` and fill values; for Render, set env vars in the dashboard.

## Environment Variables

### Core
- `DISCORD_TOKEN`
- `GUILD_ID`
- `BOT_PREFIX` (default `sf!`)
- `PORT` (optional)

### MongoDB
- `MONGO_URI`
- `MONGO_DB_NAME`
- `MONGO_CLEANUP_ENABLED`
- `MONGO_CLEANUP_INTERVAL_MS`
- `MONGO_CLEANUP_LOG`
- `RETENTION_DASHBOARD_HELP_DAYS`
- `RETENTION_SUGGESTION_DAYS`

### Bloxlink
- `BLOXLINK_API_KEY` (optional)
- `BLOXLINK_TIMEOUT_MS`

### PRC (ER:LC API)
- `PRC_KEY`
- `ERLC_TIMEOUT_MS`
- `ERLC_TIMEOUT_COMMANDLOGS_MS`
- `ERLC_BACKOFF_MS`
- `ERLC_BACKOFF_MAX_MS`
- `ERLC_GLOBAL_SPACING_MS`
- `ERLC_GLOBAL_SPACING_MAX_MS`
- `ERLC_GLOBAL_JITTER_MS`
- `ERLC_POLL_INTERVAL_PLAYERS_MS`
- `ERLC_POLL_INTERVAL_JOINLOGS_MS`
- `ERLC_POLL_INTERVAL_KILLLOGS_MS`
- `ERLC_POLL_INTERVAL_COMMANDLOGS_MS`
- `ERLC_POLL_INTERVAL_MODCALLS_MS`
- `ERLC_POLL_INTERVAL_BANS_MS`
- `ERLC_POLL_INTERVAL_QUEUE_MS`

### Channels
- `HELP_CATEGORY_ID`
- `COMMAND_LOGS_CHANNEL_ID`
- `REMINDER_CHANNEL_ID`
- `SESSIONS_CHANNEL_ID` (slash-command session notices)
- `SESSION_STATUS_CHANNEL_ID` (Session Status panel)
- `ERLC_LOG_CHANNEL_PLAYERS`
- `ERLC_LOG_CHANNEL_JOINLOGS`
- `ERLC_LOG_CHANNEL_KILLLOGS`
- `ERLC_LOG_CHANNEL_COMMANDLOGS`
- `ERLC_LOG_CHANNEL_MODCALLS`
- `ERLC_LOG_CHANNEL_BANS`
- `ERLC_LOG_CHANNEL_QUEUE`

### Roles
- `SESSIONS_PING_ROLE_ID`
- `SESSIONS_SHUTDOWN_ROLE_ID`
- `SESSIONS_TOGGLE_ROLE_ID`
- `SESSIONS_REQUIRED_ROLE_ID`
- `HELP_SUPPORT_ROLE_ID`
- `HELP_SUPPORT_ROLE_GENERAL_ID`
- `HELP_SUPPORT_ROLE_MANAGEMENT_ID`
- `RUNCMD_REQUIRED_ROLE_ID`
- `GETPLAYERS_REQUIRED_ROLE_ID`

Note: `HELP_SUPPORT_ROLE_ID` serves as a global support role that can access and manage both ticket types (General Support and Management Support). The type-specific roles (`HELP_SUPPORT_ROLE_GENERAL_ID`, `HELP_SUPPORT_ROLE_MANAGEMENT_ID`) are optional; if they are unset, the global support role is used.

### Dashboard/Ticket Panel
- `TICKET_PANEL_IMAGE_1_URL`
- `TICKET_PANEL_IMAGE_2_URL`
- `ENABLE_HTML_TRANSCRIPTS`
- `AUTO_POST_PANEL_ON_START`
- `PANEL_HISTORY_SCAN_LIMIT`
- `MAX_OPEN_TICKETS_PER_USER`
- `TOPIC_OPENER_TAG_KEY`
- `TICKET_EMBED_COLOR`

### Sessions
- `SESSIONS_EMBED_COLOR`
- `SESSIONS_START_IMAGE_URL`
- `SESSIONS_SHUTDOWN_IMAGE_URL`
- `SESSIONS_FULL_IMAGE_URL`
- `SESSIONS_BOOST_IMAGE_URL`
- `SESSIONS_POLL_IMAGE_URL`

### Session Status Panel
- `SESSION_STATUS_IMAGE_1_URL`
- `SESSION_STATUS_IMAGE_2_URL`
- `SESSION_STATUS_IMAGE_3_URL`
- `SESSION_STATUS_POLL_INTERVAL_MS`
- `PREFIX_FEEDBACK_TTL_MS` (TTL for prefix command feedback auto-delete)

### Emojis
Ephemeral feedback emojis (used across features):
- `EPHEMERAL_EMOJI_ERROR`
- `EPHEMERAL_EMOJI_PERMISSION`
- `EPHEMERAL_EMOJI_CONFIG`
- `EPHEMERAL_EMOJI_DB_DOWN`
- `EPHEMERAL_EMOJI_NOT_FOUND`
- `EPHEMERAL_EMOJI_CLAIMED`
- `EPHEMERAL_EMOJI_CREATING`
- `EPHEMERAL_EMOJI_CREATED`
- `EPHEMERAL_EMOJI_LIMIT_REACHED`
- `EPHEMERAL_EMOJI_CLOSING`
- `EPHEMERAL_EMOJI_MODAL_FAIL`
- `EPHEMERAL_EMOJI_MODAL_FAIL_RETRY`
- `EPHEMERAL_EMOJI_SUCCESS`
- `EPHEMERAL_EMOJI_SUCCESS_ADD`
- `EPHEMERAL_EMOJI_SUCCESS_REMOVE`
- `EPHEMERAL_EMOJI_VOTE_ADDED`
- `EPHEMERAL_EMOJI_VOTE_REMOVED`
- `EPHEMERAL_EMOJI_SUCCESS_FULL`
- `EPHEMERAL_EMOJI_SUCCESS_BOOST`
- `EPHEMERAL_EMOJI_SUCCESS_POLL`
- `EPHEMERAL_EMOJI_SUCCESS_START`
- `EPHEMERAL_EMOJI_LOADING`

Server info emojis:
- `SERVERINFO_EMOJI_ID`, `SERVERINFO_EMOJI_OWNER`, `SERVERINFO_EMOJI_MEMBERS`, `SERVERINFO_EMOJI_CREATED`, `SERVERINFO_EMOJI_BOOSTS`, `SERVERINFO_EMOJI_ROLES`

Ping emojis:
- `PING_EMOJI_TITLE`, `PING_EMOJI_WS`, `PING_EMOJI_RESPONSE`, `PING_EMOJI_STATUS`
- `PING_STATUS_EMOJI_EXCELLENT`, `PING_STATUS_EMOJI_GOOD`, `PING_STATUS_EMOJI_FAIR`, `PING_STATUS_EMOJI_POOR`

ER:LC emojis:
- `ERLC_EMOJI_PLAYERS`, `ERLC_EMOJI_LIST`, `ERLC_EMOJI_JOIN`, `ERLC_EMOJI_LEAVE`, `ERLC_EMOJI_PLAYER`, `ERLC_EMOJI_KILLER`, `ERLC_EMOJI_KILLED`, `ERLC_EMOJI_KILL`, `ERLC_EMOJI_COMMAND`, `ERLC_EMOJI_MODCALL`, `ERLC_EMOJI_MODERATOR`, `ERLC_EMOJI_TIME`, `ERLC_EMOJI_TYPE`, `ERLC_EMOJI_BAN`, `ERLC_EMOJI_QUEUE`, `ERLC_EMOJI_COUNT`

## Behavior Highlights
- `sf!tp` and `sf!ss` send a temporary loading message (`EPHEMERAL_EMOJI_LOADING`), then edit to success or error and auto-delete after `PREFIX_FEEDBACK_TTL_MS`.
- `sf!ss` posts or refreshes the Session Status panel in the invoking channel and includes emojis before each field title, with values displayed in code blocks.

## Project Structure (Categorized)
Commands
- `ping.js`, `help.js`, `say.js`, `avatar.js`, `userinfo.js`, `serverinfo.js`, `suggestion.js`, `reminder.js`, `players.js`, `sessions.js`, `runcmd.js`, `viewlogs.js`, `commandlogs.js`

Handlers
- `index.js` (bootstrapping), `interactionCreate.js`, `prefix.js`, `server.js`

Panels & Messages
- `messages/dash.js`, `sessionStatusPanel.js`, `sessionStatusPanel` related models

ER:LC Integration
- `erlclog.js`, `erlcserver.js`

Buttons
- `buttons/dash/*`

Modals
- `modals/dash/*`

Models
- `models/dashboardHelpSchema.js`, `models/reminderState.js`, `models/sessionStatusState.js`, `models/suggestionModel.js`

Utils
- `utils/emoji.js`, `utils/embedBuilder.js`, `utils/BloxlinkApi.js`

Scripts
- `scripts/testMongo.js`, `scripts/testPRC.js`

Notes:
- Provide valid image URLs. Local resource files are not required.
- Use unicode or full custom emoji mentions for emoji overrides (e.g., `<:name:id>` or `<a:name:id>`).
- Set `SESSIONS_STAFF_ROLE_ID` to restrict sessions commands to staff.

## Run

- `python main.py`
- The bot registers slash commands on startup; ensure the bot has `applications.commands` scope.

## Features Overview

- Ticket System
  - Send ticket panel to `TICKET_PANEL_CHANNEL_ID`
  - Open tickets via modal with reason; channel created in `TICKET_CATEGORY_ID`
  - Claim/unclaim tickets with buttons
  - Rename via modal; Close request (staff-only) with reason modal
  - Close attaches transcripts (TXT + optional HTML)
  - Only `PANEL_EMBED_IMAGE` and `AUTHOR_EMBED_IMAGE` are used; other ticket images removed
- Sessions Commands
  - `/sessions_start` with server info and Quick Join link
  - `/sessions_shutdown`, `/sessions_full`, `/sessions_boost`
  - `/sessions_poll` with vote button and voters list; previous poll in channel is auto-removed before posting a new poll
  - Staff-restricted via `SESSIONS_STAFF_ROLE_ID` or guild permissions

## Project Structure

- `main.py`: Discord bot entrypoint, command registration, ticket/session flows
- `README.md`: This guide
- Optional: any assets or config helpers referenced in the code

## Framework-Specific Requirements

- Discord Intents: enable `GUILD_MEMBERS`, `GUILD_MESSAGES` as needed in the Discord Developer Portal
- Slash Commands: app commands must be registered and may take time to propagate
- Permissions: bot requires permission to manage channels and read message history for transcripts

## Best Practices Followed

- Python conventions: structure, naming, clear async handling
- Error handling: safeguards around Discord operations and IO
- Lightweight keepalive web server for hosting platforms
- Logging via Python `logging`

## Troubleshooting

- Commands not appearing: wait up to an hour or re-invite with `applications.commands` scope
- Permission errors: check role and channel permissions for the bot
- Transcript generation failures: ensure the bot can read message history and attach files

## License

Proprietary codebase; no license headers added per request.