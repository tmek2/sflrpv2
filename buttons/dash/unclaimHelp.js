const { 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const DashboardHelpTicket = require('../../models/dashboardHelpSchema');
const mongoose = require('mongoose');
const { ephemeralEmoji } = require('../../utils/emoji');

module.exports = {
  customID: 'unclaimHelp',
  async execute(interaction) {
    try {
      const GLOBAL_SUPPORT_ROLE_ID = process.env.HELP_SUPPORT_ROLE_ID || '';
      const ROLE_GENERAL_ID = process.env.HELP_SUPPORT_ROLE_GENERAL_ID || '';
      const ROLE_MANAGEMENT_ID = process.env.HELP_SUPPORT_ROLE_MANAGEMENT_ID || '';
      const channel = interaction.channel;

      // Ensure DB is connected
      const dbConnected = mongoose.connection && mongoose.connection.readyState === 1;
      if (!dbConnected) {
        return interaction.reply({
          content: `${ephemeralEmoji('db_down')} Ticket data is currently unavailable (database not connected). Please try again later.`,
          flags: MessageFlags.Ephemeral
        });
      }
      const ticket = await DashboardHelpTicket.findOne({ channelId: channel.id });

      if (!ticket) {
        return interaction.reply({
          content: `${ephemeralEmoji('not_found')} No ticket data found for this channel.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const member = interaction.member;
      const typeRoleMap = {
        general: ROLE_GENERAL_ID,
        management: ROLE_MANAGEMENT_ID
      };
      const requiredTypeRole = typeRoleMap[ticket.type] || '';
      const allowedRoles = [
        ...String(GLOBAL_SUPPORT_ROLE_ID).split(/[\s,]+/),
        ...String(requiredTypeRole).split(/[\s,]+/)
      ].filter(Boolean);
      const hasAllowed = allowedRoles.some((rid) => member.roles.cache.has(rid));
      const isClaimer = ticket.claimedBy === interaction.user.id;
      if (!isClaimer && !hasAllowed) {
        return interaction.reply({
          content: `${ephemeralEmoji('permission')} You don't have permission to unclaim this ${ticket.type || 'support'} ticket.`,
          flags: MessageFlags.Ephemeral
        });
      }

      ticket.claimedBy = null;
      await ticket.save();

      const embed = new EmbedBuilder()
        .setDescription(`This ticket has been unclaimed.`)
      .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56');

      const claimButton = new ButtonBuilder()
        .setCustomId('claimHelp')
        .setLabel('Claim')
        .setStyle(ButtonStyle.Primary);

      const setTypeButton = new ButtonBuilder()
        .setCustomId('setTicketType')
        .setLabel('Rename')
        .setStyle(ButtonStyle.Secondary);

      const closeButton = new ButtonBuilder()
        .setCustomId('closeHelp')
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(claimButton, setTypeButton, closeButton);

      try {
        await interaction.update({ components: [row] });
      } catch (updateErr) {
        try {
          if (interaction.message?.editable) {
            await interaction.message.edit({ components: [row] });
          } else {
            await interaction.reply({ content: `${ephemeralEmoji('modal_fail_retry')} Could not update buttons; posting a fresh state.`, flags: MessageFlags.Ephemeral });
          }
        } catch {}
      }
      await channel.send({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error unclaiming ticket:', error);
      await interaction.reply({ content: `${ephemeralEmoji('error')} An error occurred while unclaiming the ticket.`, flags: MessageFlags.Ephemeral });
    }
  }
};
