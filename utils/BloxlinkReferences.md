# Bloxlink API References

Link: https://blox.link/dashboard/user/developer

## Guild API (Server-specific)

- GET `https://api.blox.link/v4/public/guilds/:serverID/discord-to-roblox/:userID`
  - Resolves a Discord user in your server to a Roblox ID.

- GET `https://api.blox.link/v4/public/guilds/:serverID/roblox-to-discord/:robloxID`
  - Resolves a Roblox user to Discord ID(s) present in your server.

## Global API

- GET `https://api.blox.link/v4/public/discord-to-roblox/:userID`
  - Resolves a Discord user to Roblox ID outside a specific server.

- GET `https://api.blox.link/v4/public/roblox-to-discord/:robloxID`
  - Resolves a Roblox user to Discord ID(s) globally (privileged).

Notes:
- Ensure the Bloxlink bot is in your Discord server for Guild API calls.
- Authorization header required: use your Bloxlink API key.
- Do not retain API data longer than allowed by their terms.