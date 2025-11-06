const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  PermissionsBitField,
} = require("discord.js");

// Simple, readable config
const REQUIRED_ROLE_ID = process.env.DASH_REQUIRED_ROLE_ID || "";
const TARGET_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID || "";
// Total messages to scan across pagination for cleanup
const PANEL_SCAN_LIMIT = Number(process.env.PANEL_HISTORY_SCAN_LIMIT || 50);
const PANEL_IMAGE_1_URL = process.env.TICKET_PANEL_IMAGE_1_URL || process.env.DASH_IMAGE_URL || "";
const PANEL_IMAGE_2_URL = process.env.TICKET_PANEL_IMAGE_2_URL || "";
const GLOBAL_EMBED_COLOR = process.env.GLOBAL_EMBED_COLOR || '#fc2f56';
const COLOR_HEX = GLOBAL_EMBED_COLOR || process.env.DASH_COLOR || "#2b2d31"; // default dark gray
const { ephemeralEmoji } = require('../utils/emoji');

function getBotPerms(channel) {
  try {
    const me = channel.guild?.members?.me;
    if (!me) return null;
    return channel.permissionsFor(me);
  } catch { return null; }
}

async function sendPanel(channel, member) {
  if (REQUIRED_ROLE_ID && !member.roles.cache.has(REQUIRED_ROLE_ID)) {
    // For interactions, the caller should handle reply; for prefix, we silently ignore
    throw new Error('permission_denied');
  }

  if (!channel || !channel.isTextBased()) {
    throw new Error('invalid_channel');
  }
  const perms = getBotPerms(channel);
  if (!perms || !perms.has(PermissionsBitField.Flags.ViewChannel) || !perms.has(PermissionsBitField.Flags.SendMessages)) {
    throw new Error('missing_perms');
  }
  const canEmbed = perms.has(PermissionsBitField.Flags.EmbedLinks);

  // Find existing panel messages (latest + older) to edit instead of posting duplicates
  let latestPanel = null;
  let olderPanels = [];
  try {
    const botId = channel.client?.user?.id;
    let scanned = 0;
    let before = undefined;
    const found = [];
    while (scanned < PANEL_SCAN_LIMIT) {
      const batchLimit = Math.min(100, PANEL_SCAN_LIMIT - scanned);
      const recent = await channel.messages.fetch({ limit: batchLimit, before }).catch(() => null);
      if (!recent || recent.size === 0) break;
      for (const [, m] of recent) {
        if (m.author?.id !== botId) continue;
        const rows = m.components || [];
        const hasTicket = rows.some(r => Array.isArray(r.components) && r.components.some(c => c?.customId === 'dashboardTicket'));
        if (hasTicket) found.push(m);
      }
      scanned += recent.size;
      before = recent.last()?.id;
      if (recent.size < batchLimit) break;
    }
    found.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    latestPanel = found[0] || null;
    olderPanels = found.slice(1);
  } catch {}

  // Build embeds
  const imageEmbed = new EmbedBuilder().setColor(COLOR_HEX);
  if (canEmbed && PANEL_IMAGE_1_URL) imageEmbed.setImage(PANEL_IMAGE_1_URL);

  const dashboardEmbed = new EmbedBuilder().setColor(COLOR_HEX);
  if (canEmbed) {
    dashboardEmbed.addFields(
      {
        name: "<:generalsupport:1434987840118460416> General Support",
        value:
          ">>> <:sflrpbullet:1434856480707969025> General Inquiries\n<:sflrpbullet:1434856480707969025> Community Concerns\n<:sflrpbullet:1434856480707969025> Department Questions\n<:sflrpbullet:1434856480707969025> Information",
        inline: true,
      },
      {
        name: "<:settingsflrp:1434930873584582748> Management Support",
        value:
          ">>> <:sflrpbullet:1434856480707969025> Reports\n<:sflrpbullet:1434856480707969025> Claiming Perks\n<:sflrpbullet:1434856480707969025> Punishment Appeal\n<:sflrpbullet:1434856480707969025> Partnerships",
        inline: true,
      }
    );
    if (PANEL_IMAGE_2_URL) dashboardEmbed.setImage(PANEL_IMAGE_2_URL);
  }

  // Components
  const ticketSelect = new StringSelectMenuBuilder()
    .setCustomId("dashboardTicket")
    .setPlaceholder("Select Ticket Type")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("General Support")
        .setValue("general")
        .setEmoji({ id: "1434987840118460416", name: "generalsupport" }),
      new StringSelectMenuOptionBuilder()
        .setLabel("Management Support")
        .setValue("management")
        .setEmoji({ id: "1434930873584582748", name: "settingsflrp" })
    );

  const row = new ActionRowBuilder().addComponents(ticketSelect);

  const payload = canEmbed
    ? { embeds: imageEmbed.data.image ? [imageEmbed, dashboardEmbed] : [dashboardEmbed], components: [row] }
    : { content: 'Select a ticket type below to open a ticket.', components: [row] };

  // If there is a latest panel, EDIT it with the new payload to avoid duplicates
  if (latestPanel) {
    try {
      await latestPanel.edit(payload);
    } catch (editErr) {
      try { await latestPanel.delete().catch(() => {}); } catch {}
      await channel.send(payload);
    }
    // Delete any older panels
    for (const msg of olderPanels) {
      try { await msg.delete(); } catch {}
    }
    return;
  }

  // Otherwise, send a new panel and clean any older panels left behind
  const newMsg = await channel.send(payload);
  for (const msg of olderPanels) {
    try { await msg.delete(); } catch {}
  }
}

module.exports = {
  data: new SlashCommandBuilder().setName("ticketpanel").setDescription("Post the ticket panel"),
  cooldown: 5,
  async execute(interaction) {
    const member = interaction.member;
    if (REQUIRED_ROLE_ID && !member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return interaction.reply({ content: `${ephemeralEmoji('permission')} You don’t have permission to post the dashboard.`, flags: MessageFlags.Ephemeral });
    }
    // Determine target channel: env-configured or current channel
    let targetChannel = interaction.channel;
    if (TARGET_CHANNEL_ID) {
      const fetched = await interaction.client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
      if (fetched && fetched.isTextBased()) targetChannel = fetched;
    }
    // Ephemeral acknowledgement, edited after panel posts
    await interaction.reply({ content: `${ephemeralEmoji('loading')} Posting dashboard…`, flags: MessageFlags.Ephemeral });
    try {
      await sendPanel(targetChannel, member);
      await interaction.editReply({ content: `${ephemeralEmoji('success')} Dashboard posted.` });
    } catch (error) {
      console.error("Error sending dashboard:", error);
      const msg = error?.message === 'permission_denied'
        ? `${ephemeralEmoji('permission')} You don’t have permission to post the dashboard.`
        : (error?.message === 'missing_perms'
            ? `${ephemeralEmoji('permission')} I’m missing permissions to post in that channel (Send Messages + Embed Links).`
            : (error?.message === 'invalid_channel'
                ? `${ephemeralEmoji('error')} Invalid target channel configured.`
                : `${ephemeralEmoji('error')} Failed to send dashboard.`));
      try { await interaction.editReply({ content: msg }); } catch {}
    }
  },
  sendPanel,
};