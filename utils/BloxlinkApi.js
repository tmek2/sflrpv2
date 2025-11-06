const axios = require('axios');
const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY || "";
const BLOXLINK_TIMEOUT_MS = Number(process.env.BLOXLINK_TIMEOUT_MS || 8000);

const bloxAxios = axios.create({
  baseURL: 'https://api.blox.link',
  timeout: BLOXLINK_TIMEOUT_MS,
  headers: { Accept: 'application/json' }
});

async function getRobloxAccount(guildId, userId) {
  if (!BLOXLINK_API_KEY) {
    return null;
  }

  let data;
  try {
    const res = await bloxAxios.get(
      `/v4/public/guilds/${guildId}/discord-to-roblox/${userId}`,
      { headers: { Authorization: BLOXLINK_API_KEY, 'x-api-key': BLOXLINK_API_KEY } }
    );
    data = res.data;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      // Retry once using Bearer scheme in case the deployment expects it
      try {
        const res2 = await bloxAxios.get(
          `/v4/public/guilds/${guildId}/discord-to-roblox/${userId}`,
          { headers: { Authorization: `Bearer ${BLOXLINK_API_KEY}`, 'x-api-key': BLOXLINK_API_KEY } }
        );
        data = res2.data;
      } catch (e2) {
        console.warn('Bloxlink lookup failed: 401 (check BLOXLINK_API_KEY and auth scheme)');
        return null;
      }
    } else {
      console.warn('Bloxlink lookup failed:', status || e?.message || e);
      return null;
    }
  }

  if (!data.robloxID) {
    return null;
  }

  let username = 'Unknown';
  let created = null;
  try {
    const userRes = await axios.get(`https://users.roblox.com/v1/users/${data.robloxID}`, { timeout: BLOXLINK_TIMEOUT_MS });
    if (userRes.data) {
      if (userRes.data.name) username = userRes.data.name;
      if (userRes.data.created) created = userRes.data.created;
    }
  } catch (e) {
    console.warn('Failed to fetch Roblox username:', e?.response?.status || e?.message || e);
  }

  const robloxAccount = `**[${username}](https://www.roblox.com/users/${data.robloxID}/profile)**  (${data.robloxID})`;
  const robloxName = `**[${username}](https://www.roblox.com/users/${data.robloxID}/profile)**`;
  let ageDays = null;
  if (created) {
    try {
      const createdDate = new Date(created);
      const now = Date.now();
      ageDays = Math.floor((now - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    } catch {}
  }

  return {
    id: data.robloxID,
    username,
    format: `**[${username}](https://www.roblox.com/users/${data.robloxID}/profile)**`,
    account: `**[${username}](https://www.roblox.com/users/${data.robloxID}/profile)** (${data.robloxID})`,
    link: `https://www.roblox.com/users/${data.robloxID}/profile`,
    created,
    ageDays
  };
}

module.exports = { getRobloxAccount };