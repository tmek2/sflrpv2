const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

module.exports = {
  customID: 'closeHelp',

  async execute(interaction) {
    const { ephemeralEmoji } = require('../../utils/emoji');
    const mongoose = require('mongoose');
    const DashboardHelpTicket = require('../../models/dashboardHelpSchema');

    const dbConnected = mongoose.connection && mongoose.connection.readyState === 1;
    if (!dbConnected) {
      return interaction.reply({ content: `${ephemeralEmoji('db_down')} Ticket data is currently unavailable (database not connected). Please try again later.`, flags: MessageFlags.Ephemeral });
    }
    const ticket = await DashboardHelpTicket.findOne({ channelId: interaction.channel.id });
    if (!ticket) {
      return interaction.reply({ content: `${ephemeralEmoji('not_found')} No ticket data found for this channel.`, flags: MessageFlags.Ephemeral });
    }

    // Close ticket is accessible to anyone; no role gating per request

    const modal = new ModalBuilder()
      .setCustomId('closeModal')
      .setTitle('Close Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('closeReason')
      .setLabel('Reason for closing (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add context for closing, if needed')
      .setRequired(false);

    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
};