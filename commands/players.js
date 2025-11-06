const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { createEmbed } = require('../utils/embedBuilder');
const { erlcEmoji, ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_EMBED_COLOR = process.env.ERLC_EMBED_COLOR || '#2b2d31';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 10000);
const REQUIRED_ROLE_ID = process.env.GETPLAYERS_REQUIRED_ROLE_ID || process.env.SESSIONS_REQUIRED_ROLE_ID || '';

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
    .setName('players')
    .setDescription('Show current players in the ER:LC private server'),
  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({ content: `${ephemeralEmoji('error')} Guild-only command.`, flags: MessageFlags.Ephemeral });
      }
      const allowed = await requireRole(interaction, REQUIRED_ROLE_ID);
      if (!allowed) return;
      if (!PRC_KEY) {
        return interaction.reply({ content: `${ephemeralEmoji('config')} PRC_KEY is not configured.`, flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const res = await prc.get('/players');
      const arr = Array.isArray(res.data) ? res.data : [];
      const count = arr.length;
      const fields = [];
      fields.push({ name: `${erlcEmoji('players')} Players Online`, value: String(count), inline: true });
      const sample = arr.slice(0, 10).map(p => `• ${fmtPlayer(p.Player)} — ${p.Team || 'Unknown'}`).join('\n');
      if (sample) fields.push({ name: `${erlcEmoji('list')} Sample`, value: sample, inline: false });

      const embed = createEmbed({
        title: `${erlcEmoji('players')} Current Server Players`,
        color: ERLC_EMBED_COLOR,
        fields,
        timestamp: true
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      try {
        await interaction.editReply({ content: `${ephemeralEmoji('error')} Failed to fetch players: ${e?.response?.status || e?.message || e}` });
      } catch {}
    }
  }
};