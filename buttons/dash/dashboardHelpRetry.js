const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const { ephemeralEmoji } = require('../../utils/emoji');

module.exports = {
  customID: 'dashboardHelpRetry',

  async execute(interaction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('dashboardHelpModal')
        .setTitle('Support Request');

      const questionInput = new TextInputBuilder()
        .setCustomId('dashboardInquiryReason')
        .setLabel('What do you need help with?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Partnership → partnership; Report → report; else General. Minor typos ok.")
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(questionInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Retry: Error showing dashboard help modal:', error);
      try { await interaction.reply({ content: `${ephemeralEmoji('modal_fail_retry')} Still unable to open the Help modal. Please try again.`, flags: MessageFlags.Ephemeral }); } catch {}
    }
  }
};