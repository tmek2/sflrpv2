const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { createEmbed } = require('../utils/embedBuilder');
const { erlcEmoji, ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_EMBED_COLOR = process.env.ERLC_EMBED_COLOR || '#2b2d31';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 10000);
const REQUIRED_ROLE_ID = process.env.KILLLOGS_REQUIRED_ROLE_ID || process.env.SESSIONS_REQUIRED_ROLE_ID || '';

const prc = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: ERLC_TIMEOUT_MS
});

function fmt(val) { return String(val ?? ''); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killlogs')
    .setDescription('View recent ER:LC kill logs'),
  async execute(interaction) {
    const ok = await requireRole(interaction, REQUIRED_ROLE_ID);
    if (!ok) return;
    try {
      if (!PRC_KEY) {
        return interaction.reply({ content: `${ephemeralEmoji('config')} PRC_KEY is not configured.`, flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const res = await prc.get('/killlogs');
      const arr = Array.isArray(res.data) ? res.data : [];
      if (!arr.length) {
        return interaction.editReply({ content: `${ephemeralEmoji('not_found')} No recent kills.` });
      }

      const limit = Math.min(arr.length, 30);
      const lines = [];
      for (let i = 0; i < limit; i++) {
        const it = arr[i];
        lines.push(`• ${fmt(it.Killer)} killed ${fmt(it.Victim)} with ${fmt(it.Weapon)} at <t:${it.Timestamp}:f>`);
      }
      const embed = createEmbed({
        title: `${erlcEmoji('kill')} Kill Logs`,
        description: lines.join('\n'),
        color: ERLC_EMBED_COLOR,
        timestamp: true
      });
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      const retry = e?.response?.headers?.['retry-after'];
      const msg = retry ? `${ephemeralEmoji('limit_reached')} Rate limited. Retry in ${retry} seconds.` : `${ephemeralEmoji('error')} Failed to fetch kill logs: ${e?.response?.status || e?.message || e}`;
      try { await interaction.editReply({ content: msg }); } catch {}
    }
  }
};