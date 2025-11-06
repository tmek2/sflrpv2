const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { createEmbed } = require('../utils/embedBuilder');
const { erlcEmoji, ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_EMBED_COLOR = process.env.ERLC_EMBED_COLOR || '#2b2d31';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 10000);
const REQUIRED_ROLE_ID = process.env.VIEWLOGS_REQUIRED_ROLE_ID || process.env.SESSIONS_REQUIRED_ROLE_ID || '';

const prc = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: ERLC_TIMEOUT_MS
});

function fmtPlayer(val) {
  if (!val || typeof val !== 'string' || !val.includes(':')) return String(val || 'Unknown');
  const [name, id] = val.split(':');
  return { name, id };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewlogs')
    .setDescription('View ER:LC command logs for a specific moderator')
    .addStringOption(option => option
      .setName('user')
      .setDescription('Enter the Roblox username (not display name)')
      .setRequired(true)
    ),
  async execute(interaction) {
    const ok = await requireRole(interaction, REQUIRED_ROLE_ID);
    if (!ok) return;
    try {
      if (!PRC_KEY) {
        return interaction.reply({ content: `${ephemeralEmoji('config')} PRC_KEY is not configured.`, flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const username = interaction.options.getString('user');
      const res = await prc.get('/commandlogs');
      const arr = Array.isArray(res.data) ? res.data : [];
      if (!arr.length) {
        return interaction.editReply({ content: `${ephemeralEmoji('not_found')} No logs found for ${username}.` });
      }

      const lines = [];
      for (const it of arr) {
        const { name } = fmtPlayer(it.Player);
        if (String(name).toLowerCase() === String(username).toLowerCase()) {
          lines.push(`• ${erlcEmoji('command')} ${name} ran "${it.Command}" at <t:${it.Timestamp}:f>`);
        }
      }
      if (!lines.length) {
        return interaction.editReply({ content: `${ephemeralEmoji('not_found')} No logs matched for ${username}.` });
      }
      const embed = createEmbed({
        title: `${erlcEmoji('command')} Command Logs for ${username}`,
        description: lines.slice(0, 30).join('\n'),
        color: ERLC_EMBED_COLOR,
        timestamp: true
      });
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      const retry = e?.response?.headers?.['retry-after'];
      const msg = retry ? `${ephemeralEmoji('limit_reached')} Rate limited. Retry in ${retry} seconds.` : `${ephemeralEmoji('error')} Failed to fetch logs: ${e?.response?.status || e?.message || e}`;
      try { await interaction.editReply({ content: msg }); } catch {}
    }
  }
};