const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const SessionStatusState = require('../models/sessionStatusState');
// Emojis removed per request; no emoji helpers needed

const GLOBAL_EMBED_COLOR = process.env.GLOBAL_EMBED_COLOR || '#fc2f56';
const COLOR_HEX = GLOBAL_EMBED_COLOR || process.env.SESSIONS_EMBED_COLOR || '#5865F2';
// Explicit images per request
const IMAGE_URL_1 = 'https://media.discordapp.net/attachments/1430646260032999465/1434222026863939704/sessions_sflrp.png?ex=690ad699&is=69098519&hm=6cba47d2b4cf337f9cbae606c858cc2247d487bc1b560ec53ddbde7547eb7164&=&format=webp&quality=lossless';
const IMAGE_URL_2 = 'https://media.discordapp.net/attachments/1430646260032999465/1435002231760879646/clearline.png?ex=690b0a39&is=6909b8b9&hm=53c842e645874a78d117bd8546a057493c422e9f70c19fb8d1aeceab70a1229b&=&format=webp&quality=lossless';
const IMAGE_URL_3 = 'https://media.discordapp.net/attachments/1430646260032999465/1434222027782492170/bottom_sflrp.png?ex=690ad699&is=69098519&hm=4a8d0ec40baa62a2c0da4a0a8a4f4a1ea916d2a156ceb202f122101281131690&=&format=webp&quality=lossless&width=1768&height=98';
const CHANNEL_ID = process.env.SESSION_STATUS_CHANNEL_ID || '';
const POLL_INTERVAL_MS = Number(process.env.SESSION_STATUS_POLL_INTERVAL_MS || 60_000);
const PRC_KEY = process.env.PRC_KEY || '';
const SESSIONS_SCAN_LIMIT = Number(process.env.SESSIONS_HISTORY_SCAN_LIMIT || 50);

function buildComponents(status) {
  // status: 'online' | 'offline' | 'unknown'
  const label = status === 'online' ? 'Session Online' : status === 'offline' ? 'Session Offline' : 'Session Status';
  const style = status === 'online' ? ButtonStyle.Success : status === 'offline' ? ButtonStyle.Danger : ButtonStyle.Secondary;

  const sessionRoleBtn = new ButtonBuilder().setCustomId('sessionsRole:button').setLabel('Session Role').setStyle(ButtonStyle.Secondary);
  const statusBtn = new ButtonBuilder().setCustomId('session_status_button').setLabel(label).setStyle(style);
  return new ActionRowBuilder().addComponents(sessionRoleBtn, statusBtn);
}

let intervalId = null;
let isUpdating = false;

function buildTopImageEmbed() {
  const e = new EmbedBuilder().setColor(COLOR_HEX);
  if (IMAGE_URL_1) e.setImage(IMAGE_URL_1);
  return e;
}

function buildScheduleEmbed() {
  const e = new EmbedBuilder().setColor(COLOR_HEX);
  const description = [
    '> Below is the current session schedule. Please be aware that adjustments may occur based on staff availability.',
    ' ',
    ' **Session Schedule** ',
    ' <:sflrpbullet:1434856480707969025> Weekdays: <t:1754953259:t> – <t:1754956800:t> ',
    ' <:sflrpbullet:1434856480707969025> Weekends: <t:1755021600:t> – <t:1754953259:t> '
  ].join('\n');
  e.setDescription(description);
  if (IMAGE_URL_2) e.setImage(IMAGE_URL_2);
  return e;
}

function buildStatsEmbed(stats) {
  const lastUpdated = stats?.timestamp ? `<t:${Math.floor(stats.timestamp / 1000)}:R>` : '—';
  const e = new EmbedBuilder().setColor(COLOR_HEX);
  // Show "Last Updated" as normal text above fields (no code block, no emoji)
  e.setDescription(`**Last Updated:** ${lastUpdated}`);

  // Stats fields (retain code blocks for values)
  e.addFields(
    { name: `Player Count`, value: `\`\`\`${stats.players}/${stats.maxPlayers}\`\`\``, inline: true },
    { name: `Active Staff`, value: `\`\`\`${stats.staff}\`\`\``, inline: true },
    { name: `In Queue`, value: `\`\`\`${stats.queue}\`\`\``, inline: true }
  );
  if (IMAGE_URL_3) e.setImage(IMAGE_URL_3);
  return e;
}

async function fetchStats() {
  if (!PRC_KEY) return null;
  try {
    const commonHeaders = { 'server-key': PRC_KEY, 'Accept': '*/*' };
    const serverRes = await axios.get('https://api.policeroleplay.community/v1/server', { headers: commonHeaders, timeout: 10000 });
    const staffRes = await axios.get('https://api.policeroleplay.community/v1/server/staff', { headers: commonHeaders, timeout: 10000 }).catch(() => ({ data: [] }));
    const queueRes = await axios.get('https://api.policeroleplay.community/v1/server/queue', { headers: commonHeaders, timeout: 10000 }).catch(() => ({ data: [] }));
    const server = serverRes.data || {};
    const stats = {
      players: Array.isArray(server.Players) ? server.Players.length : Number(server.PlayerCount || 0),
      maxPlayers: Number(server.MaxPlayers || 40),
      staff: Array.isArray(staffRes.data) ? staffRes.data.length : Number(staffRes.data?.length || 0),
      queue: Array.isArray(queueRes.data) ? queueRes.data.length : Number(queueRes.data?.length || 0),
      timestamp: Date.now()
    };
    return stats;
  } catch (err) {
    console.warn('sessionStatusPanel: fetchStats failed:', err?.message || err);
    return null;
  }
}

async function start(client, targetChannel = null) {
  try {
    // Prefer explicitly provided channel; fallback to configured channel ID
    let channel = targetChannel;
    if (!channel) {
      if (!CHANNEL_ID) return;
      channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    }
    if (!channel) return;

    // Compose three-embed panel per request
    const initStats = await fetchStats();
    const e1 = buildTopImageEmbed();
    const e2 = buildScheduleEmbed();
    const e3 = buildStatsEmbed(initStats || { players: 0, maxPlayers: 40, staff: 0, queue: 0, timestamp: Date.now() });
    const embeds = [e1, e2, e3];

    const row = buildComponents('unknown');

    // Find existing session panel messages; edit the latest and delete older ones
    let latestPanel = null;
    const olderPanels = [];
    try {
      const botId = channel.client?.user?.id;
      let scanned = 0;
      let before = undefined;
      const found = [];
      while (scanned < SESSIONS_SCAN_LIMIT) {
        const batchLimit = Math.min(100, SESSIONS_SCAN_LIMIT - scanned);
        const recent = await channel.messages.fetch({ limit: batchLimit, before }).catch(() => null);
        if (!recent || recent.size === 0) break;
        for (const [, m] of recent) {
          if (m.author?.id !== botId) continue;
          const rows = m.components || [];
          const hasSessionComponents = rows.some(r => Array.isArray(r.components) && r.components.some(c => c?.customId === 'session_status_button' || c?.customId === 'sessionsRole:button'));
          if (hasSessionComponents) found.push(m);
        }
        scanned += recent.size;
        before = recent.last()?.id;
        if (recent.size < batchLimit) break;
      }
      found.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      latestPanel = found[0] || null;
      for (const m of found.slice(1)) olderPanels.push(m);
    } catch {}

    // Prefer editing the latest existing panel; otherwise send a new one
    let state = await SessionStatusState.findOne({ key: 'default' }).catch(() => null);
    let msg = latestPanel || null;
    if (msg) {
      await msg.edit({ embeds, components: [row] }).catch(() => {});
    } else {
      msg = await channel.send({ embeds, components: [row] });
    }

    // Delete any older panels
    for (const m of olderPanels) { try { await m.delete(); } catch {} }

    if (!state) {
      state = new SessionStatusState({ key: 'default', channelId: channel.id, messageId: msg.id });
    } else {
      state.channelId = channel.id;
      state.messageId = msg.id;
    }
    state.updatedAt = new Date();
    await state.save().catch(() => {});

    // Set up periodic stats updates (rebuild all embeds; stats change reflected in third)
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(async () => {
      await updatePanel(client);
    }, Math.max(POLL_INTERVAL_MS, 30_000));
  } catch (err) {
    console.error('Failed to start session status panel:', err);
  }
}

async function setStatus(client, status) {
  try {
    const state = await SessionStatusState.findOne({ key: 'default' }).catch(() => null);
    if (!state || !state.channelId || !state.messageId) return;
    const channel = await client.channels.fetch(state.channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(state.messageId).catch(() => null);
    if (!msg) return;

    const row = buildComponents(status);
    await msg.edit({ components: [row] }).catch(() => {});
  } catch (err) {
    console.error('Failed to update session status button:', err);
  }
}

// Shared updater with concurrency guard to avoid overlapping edits
async function updatePanel(client) {
  if (isUpdating) return; // skip overlapping updates
  isUpdating = true;
  try {
    const state = await SessionStatusState.findOne({ key: 'default' }).catch(() => null);
    if (!state || !state.channelId || !state.messageId) return;
    const stats = await fetchStats();
    if (!stats) return;
    const channel = await client.channels.fetch(state.channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(state.messageId).catch(() => null);
    if (!msg) return;
    const e1u = buildTopImageEmbed();
    const e2u = buildScheduleEmbed();
    const e3u = buildStatsEmbed(stats);
    await msg.edit({ embeds: [e1u, e2u, e3u] }).catch(() => {});
  } catch (err) {
    console.warn('sessionStatusPanel: updatePanel failed:', err?.message || err);
  } finally {
    isUpdating = false;
  }
}

// Force an immediate stats refresh using the shared updater
async function refresh(client) {
  await updatePanel(client);
}

module.exports = { start, setStatus, refresh };