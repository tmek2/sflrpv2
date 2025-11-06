const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
  } = require('discord.js');
  const { ephemeralEmoji } = require('../../utils/emoji');
  
  module.exports = {
    customID: 'dashboardHelp',

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
        console.error('Error showing dashboard help modal:', error);
        try {
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
          const retry = new ButtonBuilder()
            .setCustomId('dashboardHelpRetry')
            .setLabel('Try Again')
            .setStyle(ButtonStyle.Primary);

          const row = new ActionRowBuilder().addComponents(retry);
      await interaction.reply({ content: `${ephemeralEmoji('modal_fail')} Failed to open help modal. Tap Try Again.`, components: [row], flags: MessageFlags.Ephemeral });
        } catch {}
      }
    }
  };
  