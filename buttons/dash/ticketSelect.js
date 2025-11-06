const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { ephemeralEmoji } = require('../../utils/emoji');

module.exports = {
  customID: 'dashboardTicket',

  async execute(interaction) {
    try {
      const value = Array.isArray(interaction.values) ? interaction.values[0] : interaction.values;
      if (!value || (value !== 'general' && value !== 'management')) {
        return interaction.reply({ content: `${ephemeralEmoji('error')} Invalid selection.`, flags: MessageFlags.Ephemeral });
      }

      const modalId = value === 'general' ? 'dashboardGeneralModal' : 'dashboardManagementModal';
      const modalTitle = value === 'general' ? 'General Ticket' : 'Management Ticket';

      const modal = new ModalBuilder().setCustomId(modalId).setTitle(modalTitle);

      const questionInput = new TextInputBuilder()
        .setCustomId('dashboardTicketReason')
        .setLabel('Describe your issue')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Provide relevant details to help us assist you.')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(questionInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing ticket modal:', error);
      try { await interaction.reply({ content: `${ephemeralEmoji('modal_fail')} Unable to open the ticket modal. Please try again.`, flags: MessageFlags.Ephemeral }); } catch {}
    }
  }
};