const { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// Config sourced from environment; avoid hardcoded fallbacks
// Use strings for Discord snowflake IDs to avoid precision loss
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || '';
const AUTO_ROLE_1_ID = process.env.AUTO_ROLE_1_ID || '';
const AUTO_ROLE_2_ID = process.env.AUTO_ROLE_2_ID || '';

const COUNTER_EMOJI_SPEC = process.env.COUNTER_EMOJI_SPEC || '<:ppl:1434932030977736735>';
const LINK_EMOJI_SPEC = process.env.LINK_EMOJI_SPEC || '<:greatidea:1434932010777968780>';
const LINK_LABEL = process.env.LINK_LABEL || 'Information';
const LINK_URL = process.env.LINK_URL || 'https://discord.com/channels/1370798053899894926/1370856611287007384';

function parseEmoji(spec) {
  if (!spec) return undefined;
  if (typeof spec !== 'string') return spec;
  const m = spec.trim().match(/^<(a?):([A-Za-z0-9_~]+):(\d+)>$/);
  if (m) return { animated: !!m[1], name: m[2], id: m[3] };
  return spec; // unicode
}

function makeWelcomeComponents(guild) {
  const count = guild.memberCount ?? guild.members?.cache?.size ?? 0;
  const countButton = new ButtonBuilder()
    .setLabel(` ${count}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)
    .setCustomId('welcome_member_count')
    .setEmoji(parseEmoji(COUNTER_EMOJI_SPEC));

  const linkButton = new ButtonBuilder()
    .setLabel(LINK_LABEL)
    .setStyle(ButtonStyle.Link)
    .setURL(LINK_URL)
    .setEmoji(parseEmoji(LINK_EMOJI_SPEC));

  // Place both buttons on a single row, Information first
  const row = new ActionRowBuilder().addComponents(linkButton, countButton);
  return [row];
}

async function handleMemberJoin(member) {
  const guild = member.guild;
  const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) {
    console.warn('WELCOME_CHANNEL_ID not found. Check the ID.');
    return;
  }

  // Assign roles by ID
  for (const rid of [AUTO_ROLE_1_ID, AUTO_ROLE_2_ID]) {
    if (!rid) continue;
    const role = guild.roles.cache.get(rid);
    if (role) {
      try { await member.roles.add(role); } catch (e) {
        console.warn(`Could not assign role ${role.name}: ${e.message}`);
      }
    }
  }

  const components = makeWelcomeComponents(guild);
  const content = `Hello ${member.toString()}, welcome to **<:sflrpmini:1434987257609326762> South Florida Roleplay**! We’re glad to have you here!`;
  try {
    await channel.send({ content, components });
  } catch (err) {
    console.error('Error sending welcome message:', err);
  }
}

async function handleMessageCreate(message) {
  if (message.author.bot) return;
  const lower = message.content.toLowerCase();
  if (lower.includes('sflrp sucks')) {
    try { await message.delete(); } catch {}
    try { await message.channel.send(`${message.author} - don't use naughty language!`); } catch {}
    return;
  }

}

function initWelcoming(client) {
  client.on(Events.GuildMemberAdd, handleMemberJoin);
  client.on(Events.MessageCreate, handleMessageCreate);
}

module.exports = initWelcoming;