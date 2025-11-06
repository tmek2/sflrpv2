const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { createEmbed } = require('../utils/embedBuilder');
const { erlcEmoji, ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_EMBED_COLOR = process.env.ERLC_EMBED_COLOR || '#2b2d31';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 10000);
const REQUIRED_ROLE_ID = process.env.ERLCSERVER_REQUIRED_ROLE_ID || process.env.SESSIONS_REQUIRED_ROLE_ID || '';

const prc = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: ERLC_TIMEOUT_MS
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('erlcserver')
    .setDescription('View the current ER:LC private server status'),
  async execute(interaction) {
    const ok = await requireRole(interaction, REQUIRED_ROLE_ID);
    if (!ok) return;
    try {
      if (!PRC_KEY) {
        return interaction.reply({ content: `${ephemeralEmoji('config')} PRC_KEY is not configured.`, flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const res = await prc.get('/');
      const s = res.data || {};
      const tBalance = s.TeamBalance === true ? 'On' : 'Off';

      const fields = [];
      fields.push({ name: 'Name', value: String(s.Name || 'Unknown'), inline: true });
      fields.push({ name: 'Players', value: `${s.CurrentPlayers ?? 0} / ${s.MaxPlayers ?? '?'}`, inline: true });
      fields.push({ name: 'Join Key', value: String(s.JoinKey || 'N/A'), inline: true });
      fields.push({ name: 'Verification', value: `${s.AccVerifiedReq ? 'Required' : 'Not Required'}`, inline: true });
      fields.push({ name: 'Team Balance', value: tBalance, inline: true });

      const embed = createEmbed({
        title: `ER:LC Server Info`,
        color: ERLC_EMBED_COLOR,
        fields,
        timestamp: true
      });
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      const retry = e?.response?.headers?.['retry-after'];
      const msg = retry ? `${ephemeralEmoji('limit_reached')} Rate limited. Retry in ${retry} seconds.` : `${ephemeralEmoji('error')} Failed to fetch server info: ${e?.response?.status || e?.message || e}`;
      try { await interaction.editReply({ content: msg }); } catch {}
    }
  }
};