// ER:LC periodic logger: polls PRC endpoints and posts to channels.
const axios = require('axios');
const { createEmbed } = require('./utils/embedBuilder');
const { erlcEmoji } = require('./utils/emoji');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 8000);
const ERLC_EMBED_COLOR = process.env.ERLC_EMBED_COLOR || '#2b2d31';

// Backoff and spacing configuration
const BACKOFF_BASE = Number(process.env.ERLC_BACKOFF_MS || 60000);
const BACKOFF_MAX = Number(process.env.ERLC_BACKOFF_MAX_MS || 120000);
const SPACING_MIN = Number(process.env.ERLC_GLOBAL_SPACING_MS || 120000); // 2m
const SPACING_MAX = Number(process.env.ERLC_GLOBAL_SPACING_MAX_MS || 240000); // 4m
const JITTER_MS = Number(process.env.ERLC_GLOBAL_JITTER_MS || 5000);

// Endpoint-specific intervals
const INTERVALS = {
  players: Number(process.env.ERLC_POLL_INTERVAL_PLAYERS_MS || 360000),
  joinlogs: Number(process.env.ERLC_POLL_INTERVAL_JOINLOGS_MS || 150000),
  killlogs: Number(process.env.ERLC_POLL_INTERVAL_KILLLOGS_MS || 210000),
  commandlogs: Number(process.env.ERLC_POLL_INTERVAL_COMMANDLOGS_MS || 180000),
  modcalls: Number(process.env.ERLC_POLL_INTERVAL_MODCALLS_MS || 150000),
  bans: Number(process.env.ERLC_POLL_INTERVAL_BANS_MS || 360000),
  queue: Number(process.env.ERLC_POLL_INTERVAL_QUEUE_MS || 150000)
};

// Target channel IDs
const CHANNELS = {
  players: process.env.ERLC_LOG_CHANNEL_PLAYERS || '',
  joinlogs: process.env.ERLC_LOG_CHANNEL_JOINLOGS || '',
  killlogs: process.env.ERLC_LOG_CHANNEL_KILLLOGS || '',
  commandlogs: process.env.ERLC_LOG_CHANNEL_COMMANDLOGS || '',
  modcalls: process.env.ERLC_LOG_CHANNEL_MODCALLS || '',
  bans: process.env.ERLC_LOG_CHANNEL_BANS || '',
  queue: process.env.ERLC_LOG_CHANNEL_QUEUE || ''
};

const prc = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: ERLC_TIMEOUT_MS
});

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function sendToChannel(client, channelId, payload) {
  if (!channelId) return false;
  try {
    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
    await channel.send(payload);
    return true;
  } catch (e) {
    console.warn(`[ERLC] Failed to send to channel ${channelId}:`, e?.message || e);
    return false;
  }
}

// Keep last seen timestamps to avoid reposting old logs
const state = {
  players: { lastCount: -1 }, // Track last player count to detect changes
  joinlogs: { lastTs: Math.floor(Date.now() / 1000) - 600 },
  killlogs: { lastTs: Math.floor(Date.now() / 1000) - 600 },
  commandlogs: { lastTs: Math.floor(Date.now() / 1000) - 600 },
  modcalls: { lastTs: Math.floor(Date.now() / 1000) - 600 },
  bans: { lastTs: Math.floor(Date.now() / 1000) - 600 },
  queue: { lastTs: Math.floor(Date.now() / 1000) - 600 }
};

const backoff = {
  joinlogs: BACKOFF_BASE,
  killlogs: BACKOFF_BASE,
  commandlogs: BACKOFF_BASE,
  modcalls: BACKOFF_BASE,
  bans: BACKOFF_BASE,
  queue: BACKOFF_BASE,
  players: BACKOFF_BASE
};

// Per-feed gating to respect backoff and prevent overlapping runs
const nextAt = {
  players: 0,
  joinlogs: 0,
  killlogs: 0,
  commandlogs: 0,
  modcalls: 0,
  bans: 0,
  queue: 0
};

const running = {
  players: false,
  joinlogs: false,
  killlogs: false,
  commandlogs: false,
  modcalls: false,
  bans: false,
  queue: false
};

function fmtPlayer(val) {
  if (!val || typeof val !== 'string' || !val.includes(':')) return String(val || 'Unknown');
  const [name, id] = val.split(':');
  return `${name} (${id})`;
}

function buildEmbed({ title, description, fields }) {
  return createEmbed({ title, description, fields, color: ERLC_EMBED_COLOR, timestamp: true });
}

async function pollPlayers(client) {
  const channelId = CHANNELS.players;
  if (!channelId) return; // Skip if not configured
  if (running.players) return;
  const now = Date.now();
  if (now < nextAt.players) return;
  try {
    running.players = true;
    await sleep(randInt(SPACING_MIN, SPACING_MAX));
    const res = await prc.get('/players');
    const arr = Array.isArray(res.data) ? res.data : [];
    const count = arr.length;
    
    // Only log if player count has changed
    if (count === state.players.lastCount) {
      return; // No change, skip logging
    }
    
    state.players.lastCount = count; // Update last seen count
    const sample = arr.slice(0, 10).map(p => `• ${fmtPlayer(p.Player)} — ${p.Team || 'Unknown'}`).join('\n');
    const fields = [
      { name: `${erlcEmoji('players')} Players Online`, value: String(count), inline: true }
    ];
    if (sample) fields.push({ name: `${erlcEmoji('list')} Sample`, value: sample, inline: false });
    const embed = buildEmbed({ title: `${erlcEmoji('players')} Current Server Players`, fields });
    await sendToChannel(client, channelId, { embeds: [embed] });
    backoff.players = BACKOFF_BASE; // reset backoff on success
    nextAt.players = 0;
  } catch (e) {
    const code = e?.response?.status;
    const retryAfterSec = Number(e?.response?.headers?.['retry-after'] || 0);
    if (code === 429) {
      backoff.players = Math.min(backoff.players * 2, BACKOFF_MAX);
      const waitMs = Math.max(backoff.players, retryAfterSec * 1000);
      nextAt.players = Date.now() + waitMs;
      console.warn(`[ERLC] players rate-limited. Backoff now ${waitMs}ms`);
    } else {
      console.warn('[ERLC] players poll failed:', e?.message || e);
    }
  } finally {
    running.players = false;
  }
}

async function pollJoinLogs(client) {
  const channelId = CHANNELS.joinlogs;
  if (!channelId) return;
  if (running.joinlogs) return;
  const now = Date.now();
  if (now < nextAt.joinlogs) return;
  try {
    running.joinlogs = true;
    await sleep(randInt(SPACING_MIN, SPACING_MAX));
    const res = await prc.get('/joinlogs');
    const arr = Array.isArray(res.data) ? res.data : [];
    const fresh = arr.filter(it => Number(it.Timestamp || 0) > (state.joinlogs.lastTs || 0));
    if (!fresh.length) return;
    fresh.sort((a, b) => a.Timestamp - b.Timestamp);
    state.joinlogs.lastTs = fresh[fresh.length - 1].Timestamp;
    // Build separate embeds for joins and leaves, with custom colors and no per-line emojis
    const joinLines = fresh.filter(it => it.Join).slice(0, 30)
      .map(it => `• ${fmtPlayer(it.Player)} joined at <t:${it.Timestamp}:f>`);
    const leaveLines = fresh.filter(it => !it.Join).slice(0, 30)
      .map(it => `• ${fmtPlayer(it.Player)} left at <t:${it.Timestamp}:f>`);

    const embeds = [];
    if (joinLines.length) {
      embeds.push(createEmbed({
        title: `${erlcEmoji('join')} Join Logs`,
        description: joinLines.join('\n'),
        color: '#38cd38',
        timestamp: true
      }));
    }
    if (leaveLines.length) {
      embeds.push(createEmbed({
        title: `${erlcEmoji('leave')} Leave Logs`,
        description: leaveLines.join('\n'),
        color: '#fc2f2f',
        timestamp: true
      }));
    }
    if (embeds.length) {
      await sendToChannel(client, channelId, { embeds });
    }
    backoff.joinlogs = BACKOFF_BASE;
    nextAt.joinlogs = 0;
  } catch (e) {
    const code = e?.response?.status;
    const retryAfterSec = Number(e?.response?.headers?.['retry-after'] || 0);
    if (code === 429) {
      backoff.joinlogs = Math.min(backoff.joinlogs * 2, BACKOFF_MAX);
      const waitMs = Math.max(backoff.joinlogs, retryAfterSec * 1000);
      nextAt.joinlogs = Date.now() + waitMs;
      console.warn(`[ERLC] joinlogs rate-limited. Backoff now ${waitMs}ms`);
    } else {
      console.warn('[ERLC] joinlogs poll failed:', e?.message || e);
    }
  } finally {
    running.joinlogs = false;
  }
}

async function pollKillLogs(client) {
  const channelId = CHANNELS.killlogs;
  if (!channelId) return;
  if (running.killlogs) return;
  const now = Date.now();
  if (now < nextAt.killlogs) return;
  try {
    running.killlogs = true;
    await sleep(randInt(SPACING_MIN, SPACING_MAX));
    const res = await prc.get('/killlogs');
    const arr = Array.isArray(res.data) ? res.data : [];
    const fresh = arr.filter(it => Number(it.Timestamp || 0) > (state.killlogs.lastTs || 0));
    if (!fresh.length) return;
    fresh.sort((a, b) => a.Timestamp - b.Timestamp);
    state.killlogs.lastTs = fresh[fresh.length - 1].Timestamp;
    const lines = fresh.slice(0, 15).map(it => `• ${erlcEmoji('kill')} ${fmtPlayer(it.Killer)} killed ${fmtPlayer(it.Killed)} at <t:${it.Timestamp}:f>`);
    const embed = buildEmbed({ title: `${erlcEmoji('kill')} Kill Logs`, description: lines.join('\n') });
    await sendToChannel(client, channelId, { embeds: [embed] });
    backoff.killlogs = BACKOFF_BASE;
    nextAt.killlogs = 0;
  } catch (e) {
    const code = e?.response?.status;
    const retryAfterSec = Number(e?.response?.headers?.['retry-after'] || 0);
    if (code === 429) {
      backoff.killlogs = Math.min(backoff.killlogs * 2, BACKOFF_MAX);
      const waitMs = Math.max(backoff.killlogs, retryAfterSec * 1000);
      nextAt.killlogs = Date.now() + waitMs;
      console.warn(`[ERLC] killlogs rate-limited. Backoff now ${waitMs}ms`);
    } else {
      console.warn('[ERLC] killlogs poll failed:', e?.message || e);
    }
  } finally {
    running.killlogs = false;
  }
}

async function pollCommandLogs(client) {
  const channelId = CHANNELS.commandlogs;
  if (!channelId) return;
  if (running.commandlogs) return;
  const now = Date.now();
  if (now < nextAt.commandlogs) return;
  try {
    running.commandlogs = true;
    await sleep(randInt(SPACING_MIN, SPACING_MAX));
    const res = await prc.get('/commandlogs');
    const arr = Array.isArray(res.data) ? res.data : [];
    const fresh = arr.filter(it => Number(it.Timestamp || 0) > (state.commandlogs.lastTs || 0));
    if (!fresh.length) return;
    fresh.sort((a, b) => a.Timestamp - b.Timestamp);
    state.commandlogs.lastTs = fresh[fresh.length - 1].Timestamp;
    const lines = fresh.slice(0, 20).map(it => `• ${erlcEmoji('command')} ${fmtPlayer(it.Player)} ran "${it.Command}" at <t:${it.Timestamp}:f>`);
    const embed = buildEmbed({ title: `${erlcEmoji('command')} Command Logs`, description: lines.join('\n') });
    await sendToChannel(client, channelId, { embeds: [embed] });
    backoff.commandlogs = BACKOFF_BASE;
    nextAt.commandlogs = 0;
  } catch (e) {
    const code = e?.response?.status;
    const retryAfterSec = Number(e?.response?.headers?.['retry-after'] || 0);
    if (code === 429) {
      backoff.commandlogs = Math.min(backoff.commandlogs * 2, BACKOFF_MAX);
      const waitMs = Math.max(backoff.commandlogs, retryAfterSec * 1000);
      nextAt.commandlogs = Date.now() + waitMs;
      console.warn(`[ERLC] commandlogs rate-limited. Backoff now ${waitMs}ms`);
    } else {
      console.warn('[ERLC] commandlogs poll failed:', e?.message || e);
    }
  } finally {
    running.commandlogs = false;
  }
}

// Optional endpoints: modcalls, bans, queue — only if channels are configured
async function pollGenericList(client, key, path, title, iconKey, limit = 20, formatItem) {
  const channelId = CHANNELS[key];
  if (!channelId) return;
  if (running[key]) return;
  const now = Date.now();
  if (now < nextAt[key]) return;
  try {
    running[key] = true;
    await sleep(randInt(SPACING_MIN, SPACING_MAX));
    const res = await prc.get(path);
    const arr = Array.isArray(res.data) ? res.data : [];
    const last = state[key]?.lastTs || 0;
    const fresh = arr.filter(it => Number(it.Timestamp || 0) > last);
    if (!fresh.length) return;
    fresh.sort((a, b) => a.Timestamp - b.Timestamp);
    state[key] = { lastTs: fresh[fresh.length - 1].Timestamp };
    const lines = fresh.slice(0, limit).map(formatItem);
    const embed = buildEmbed({ title: `${erlcEmoji(iconKey)} ${title}`, description: lines.join('\n') });
    await sendToChannel(client, channelId, { embeds: [embed] });
    backoff[key] = BACKOFF_BASE;
    nextAt[key] = 0;
  } catch (e) {
    const code = e?.response?.status;
    const retryAfterSec = Number(e?.response?.headers?.['retry-after'] || 0);
    if (code === 429) {
      backoff[key] = Math.min(backoff[key] * 2, BACKOFF_MAX);
      const waitMs = Math.max(backoff[key], retryAfterSec * 1000);
      nextAt[key] = Date.now() + waitMs;
      console.warn(`[ERLC] ${key} rate-limited. Backoff now ${waitMs}ms`);
    } else {
      console.warn(`[ERLC] ${key} poll failed:`, e?.message || e);
    }
  } finally {
    running[key] = false;
  }
}

function start(client) {
  try {
    if (!PRC_KEY) {
      console.warn('ER:LC logger disabled: PRC_KEY not set.');
      return;
    }

    console.log('ER:LC periodic logger starting...');

    // Stagger initial scheduling to avoid burst
    const schedules = [
      // Players feed disabled: keep command-only, no periodic logging
      () => setInterval(() => pollJoinLogs(client), INTERVALS.joinlogs + randInt(-JITTER_MS, JITTER_MS)),
      () => setInterval(() => pollKillLogs(client), INTERVALS.killlogs + randInt(-JITTER_MS, JITTER_MS)),
      () => setInterval(() => pollCommandLogs(client), INTERVALS.commandlogs + randInt(-JITTER_MS, JITTER_MS)),
      // Optional endpoints — only scheduled if a channel is set
      () => CHANNELS.modcalls && setInterval(() => pollGenericList(client, 'modcalls', '/modcalls', 'Mod Calls', 'modcall', 20, it => `• ${erlcEmoji('modcall')} ${fmtPlayer(it.Moderator || it.Player)} at <t:${it.Timestamp}:f>`), INTERVALS.modcalls + randInt(-JITTER_MS, JITTER_MS)),
      () => CHANNELS.bans && setInterval(() => pollGenericList(client, 'bans', '/bans', 'Bans', 'ban', 20, it => `• ${erlcEmoji('ban')} ${fmtPlayer(it.Player)} at <t:${it.Timestamp}:f>`), INTERVALS.bans + randInt(-JITTER_MS, JITTER_MS)),
      () => CHANNELS.queue && setInterval(() => pollGenericList(client, 'queue', '/queue', 'Queue', 'queue', 20, it => `• ${erlcEmoji('queue')} ${fmtPlayer(it.Player)} at <t:${it.Timestamp}:f>`), INTERVALS.queue + randInt(-JITTER_MS, JITTER_MS))
    ];

    // Remove initial burst calls to avoid startup rate-limits; rely on intervals only

    // Start intervals
    let offset = 0;
    for (const startSchedule of schedules) {
      setTimeout(() => { startSchedule(); }, offset);
      offset += 1000; // small stagger between setting intervals
    }

    console.log('ER:LC periodic logger started.');
  } catch (e) {
    console.warn('ER:LC logger failed to initialize:', e?.message || e);
  }
}

module.exports = { start };