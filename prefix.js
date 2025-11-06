const { Events, EmbedBuilder } = require('discord.js');
const dash = require('./messages/dash');
const sessionStatusPanel = require('./panels/sessionStatusPanel');
const { ephemeralEmoji } = require('./utils/emoji');

const FEEDBACK_TTL_MS = Number(process.env.PREFIX_FEEDBACK_TTL_MS || 3000);

async function safeDelete(message) {
  try { await message.delete(); } catch {}
}

async function transientSend(message, content) {
  let m = null;
  try {
    m = await message.channel.send(content);
  } catch {}
  if (m) setTimeout(() => m.delete().catch(() => {}), FEEDBACK_TTL_MS);
  return m;
}

const PREFIX = process.env.BOT_PREFIX || 'sf!';
// Guard against duplicate message handling (e.g., multiple listeners or re-emits)
const handledPrefixMessageIds = new Set();

function initPrefix(client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;
      const content = message.content.trim();
      if (!content.startsWith(PREFIX)) return;
      // Deduplicate handling for this message ID
      if (handledPrefixMessageIds.has(message.id)) return;
      handledPrefixMessageIds.add(message.id);
      setTimeout(() => handledPrefixMessageIds.delete(message.id), 120000);

      const withoutPrefix = content.slice(PREFIX.length).trim();
      const [cmd, ...args] = withoutPrefix.split(/\s+/);
      const member = message.member;
      if (!member) return;
      // Unified role gating for all prefix commands — supports comma-separated role IDs
      const rawPrefixRoles = (process.env.PREFIX_REQUIRED_ROLE_ID || '').trim();
      const requiredRoleIds = rawPrefixRoles
        ? rawPrefixRoles.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const hasRequiredRole = requiredRoleIds.length === 0
        ? true
        : requiredRoleIds.some(id => member.roles.cache.has(id));
      if (!hasRequiredRole) {
        await safeDelete(message);
        // Silent denial: no extra messages
        return;
      }

      if (cmd.toLowerCase() === 'tp') {
        // Ticket panel posting to configured channel (no fallback)
        const targetChannelId = process.env.PREFIX_TP_CHANNEL_ID || process.env.TICKET_PANEL_CHANNEL_ID || '';
        await safeDelete(message);
        let targetChannel = message.channel;
        if (targetChannelId) {
          try { const fetched = await message.client.channels.fetch(targetChannelId); if (fetched && fetched.isTextBased()) targetChannel = fetched; } catch {}
        }
        const ack = await transientSend(message, `${ephemeralEmoji('loading')} Posting dashboard…`);
        try {
          await dash.sendPanel(targetChannel, member);
          if (ack) { try { await ack.edit(`${ephemeralEmoji('success')} Dashboard posted.`); } catch {} }
        } catch (e) {
          if (ack) { try { await ack.edit(`${ephemeralEmoji('error')} Failed to post dashboard.`); } catch {} }
        }
      } else if (cmd.toLowerCase() === 'ss') {
        await safeDelete(message);
        const targetChannelId = process.env.PREFIX_SS_CHANNEL_ID || process.env.SESSION_STATUS_PANEL_CHANNEL_ID || '';
        let targetChannel = message.channel;
        if (targetChannelId) {
          try { const fetched = await message.client.channels.fetch(targetChannelId); if (fetched && fetched.isTextBased()) targetChannel = fetched; } catch {}
        }
        const ack = await transientSend(message, `${ephemeralEmoji('loading')} Posting Session Status panel…`);
        try {
          // Post the Session Status panel in the configured target channel
          await sessionStatusPanel.start(message.client, targetChannel);
          if (ack) { try { await ack.edit(`${ephemeralEmoji('success')} Session Status panel posted.`); } catch {} }
        } catch (e) {
          if (ack) { try { await ack.edit(`${ephemeralEmoji('error')} Failed to post Session Status panel.`); } catch {} }
        }
      } else if (cmd.toLowerCase() === 'pr') {
        // Delete the invoking message and silently post the embed
        await safeDelete(message);
        const targetChannelId = process.env.PREFIX_PR_CHANNEL_ID || process.env.PR_TARGET_CHANNEL_ID || '';
        const color = process.env.GLOBAL_EMBED_COLOR || '#fc2f56';

        let targetChannel = message.channel;
        if (targetChannelId) {
          try { const fetched = await message.client.channels.fetch(targetChannelId); if (fetched && fetched.isTextBased()) targetChannel = fetched; } catch {}
        }
        try {
          const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('<:sflrpmini:1434987257609326762> |  Partnership Format')
            .setDescription("```Server's Name:\n\nServer Owner:\n\nYour Rank:\n\nMember Count (excluding bots):\n\nServer Invite (code only, ex. xa2pwjQMvS):\n\n```")
            .setImage('https://media.discordapp.net/attachments/1430646260032999465/1434222027782492170/bottom_sflrp.png?ex=690b7f59&is=690a2dd9&hm=2b93a86a67db6973a1678f8c4e1b3c14e39f0940ab9b399793988796c6617631&=&format=webp&quality=lossless&width=1768&height=98');
          await targetChannel.send({ embeds: [embed] });
        } catch (e) {
          // Silent failure: no confirmations or error messages
        }
      }
    } catch (err) {
      console.error('Prefix handler error:', err);
      // Silent on errors for prefix commands; no extra messages
    }
  });
}

module.exports = { initPrefix };