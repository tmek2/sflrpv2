const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');

const PRC_KEY = process.env.PRC_KEY || '';
const ERLC_TIMEOUT_MS = Number(process.env.ERLC_TIMEOUT_MS || 10000);
const COMMAND_LOGS_CHANNEL_ID = process.env.COMMAND_LOGS_CHANNEL_ID || '';
const REQUIRED_ROLE_ID = process.env.RUNCMD_REQUIRED_ROLE_ID || process.env.SESSIONS_REQUIRED_ROLE_ID || '';
// Backoff config aligned with ER:LC logger
const BACKOFF_BASE = Number(process.env.ERLC_BACKOFF_MS || 60000);
const BACKOFF_MAX = Number(process.env.ERLC_BACKOFF_MAX_MS || 120000);
let nextAt = 0;
let backoffMs = BACKOFF_BASE;

const prc = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: ERLC_TIMEOUT_MS
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('runcmd')
    .setDescription('Run a command on the ER:LC private server')
    .addStringOption(option => option
      .setName('command')
      .setDescription('Exact command text as in-game (e.g., ":m Hello")')
      .setRequired(true)
    ),
  async execute(interaction, client) {
    try {
      if (!interaction.guild) {
        return interaction.reply({ content: `${ephemeralEmoji('error')} Guild-only command.`, flags: MessageFlags.Ephemeral });
      }
      const allowed = await requireRole(interaction, REQUIRED_ROLE_ID);
      if (!allowed) return;
      if (!PRC_KEY) {
        return interaction.reply({ content: `${ephemeralEmoji('config')} PRC_KEY is not configured.`, flags: MessageFlags.Ephemeral });
      }

      const cmd = interaction.options.getString('command');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Respect current backoff window if previously rate-limited
      const now = Date.now();
      if (now < nextAt) {
        const waitSec = Math.ceil((nextAt - now) / 1000);
        await interaction.editReply({ content: `${ephemeralEmoji('loading')} Waiting ${waitSec}s due to rate limit…` });
        await new Promise(res => setTimeout(res, nextAt - now));
      }

      let res;
      try {
        res = await prc.post('/command', { command: cmd }, { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        const code = e?.response?.status;
        const retryAfterSec = Number(e?.response?.headers?.['retry-after'] || 0);
        if (code === 429) {
          // Compute wait and retry once automatically
          backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
          const waitMs = Math.max(backoffMs, retryAfterSec * 1000);
          nextAt = Date.now() + waitMs;
          const waitSec = Math.ceil(waitMs / 1000);
          await interaction.editReply({ content: `${ephemeralEmoji('limit_reached')} Rate limited. Retrying in ${waitSec}s…` });
          await new Promise(res => setTimeout(res, waitMs));
          // Retry once
          res = await prc.post('/command', { command: cmd }, { headers: { 'Content-Type': 'application/json' } });
          // Reset backoff on success
          backoffMs = BACKOFF_BASE;
          nextAt = 0;
        } else {
          throw e;
        }
      }
      const ok = res?.data?.message === 'Success' || (res?.status >= 200 && res?.status < 300);
      if (!ok) {
        const msg = res?.data?.message ? `Error: ${res.data.message}` : `Unexpected response (${res?.status}).`;
        return interaction.editReply({ content: `${ephemeralEmoji('error')} ${msg}` });
      }

      if (COMMAND_LOGS_CHANNEL_ID) {
        try {
          const channel = client.channels.cache.get(COMMAND_LOGS_CHANNEL_ID);
          if (channel) {
            const embed = new EmbedBuilder()
              .setTitle('ER:LC Remote Command')
              .setDescription(`${interaction.user.username} used remote server to run \`${cmd}\``)
              .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          }
        } catch {}
      }
      await interaction.editReply({ content: `${ephemeralEmoji('success')} Command executed successfully by <@${interaction.member.id}>.` });
    } catch (e) {
      const retry = e?.response?.headers?.['retry-after'];
      const msg = retry ? `${ephemeralEmoji('limit_reached')} Rate limited. Retry in ${retry} seconds.` : `${ephemeralEmoji('error')} Failed to run command: ${e?.response?.data?.message || e?.message || e}`;
      try { await interaction.editReply({ content: msg }); } catch {}
    }
  }
};