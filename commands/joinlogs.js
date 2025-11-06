const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { createEmbed } = require('../utils/embedBuilder');
const { erlcEmoji, ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_EMBED_COLOR = process.env.ERLC_EMBED_COLOR || '#2b2d31';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 10000);
const REQUIRED_ROLE_ID = process.env.JOINLOGS_REQUIRED_ROLE_ID || process.env.SESSIONS_REQUIRED_ROLE_ID || '';

const prc = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: ERLC_TIMEOUT_MS
});

function fmtPlayer(val) {
  if (!val || typeof val !== 'string' || !val.includes(':')) return String(val || 'Unknown');
  const [name, id] = val.split(':');
  return `${name} (${id})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joinlogs')
    .setDescription('View recent ER:LC join/leave logs'),
  async execute(interaction) {
    const ok = await requireRole(interaction, REQUIRED_ROLE_ID);
    if (!ok) return;
    try {
      if (!PRC_KEY) {
        return interaction.reply({ content: `${ephemeralEmoji('config')} PRC_KEY is not configured.`, flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const res = await prc.get('/joinlogs');
      const arr = Array.isArray(res.data) ? res.data : [];
      if (!arr.length) {
        return interaction.editReply({ content: `${ephemeralEmoji('not_found')} No recent joins.` });
      }

      const joinLines = arr.filter(it => it.Join).slice(0, 30)
        .map(it => `• ${fmtPlayer(it.Player)} joined at <t:${it.Timestamp}:f>`);
      const leaveLines = arr.filter(it => !it.Join).slice(0, 30)
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
      await interaction.editReply({ embeds });
    } catch (e) {
      const retry = e?.response?.headers?.['retry-after'];
      const msg = retry ? `${ephemeralEmoji('limit_reached')} Rate limited. Retry in ${retry} seconds.` : `${ephemeralEmoji('error')} Failed to fetch join logs: ${e?.response?.status || e?.message || e}`;
      try { await interaction.editReply({ content: msg }); } catch {}
    }
  }
};