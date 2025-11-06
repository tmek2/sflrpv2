const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ephemeralEmoji } = require('../../utils/emoji');

const SUPPORT_ROLE_ID = process.env.HELP_SUPPORT_ROLE_ID || '';
const ROLE_GENERAL_ID = process.env.HELP_SUPPORT_ROLE_GENERAL_ID || '';
const ROLE_MANAGEMENT_ID = process.env.HELP_SUPPORT_ROLE_MANAGEMENT_ID || '';
// Only general and management ticket types are supported

module.exports = {
  customID: 'setTicketType',

  async execute(interaction) {
    try {
      const member = interaction.member;
      const allowedRoles = [SUPPORT_ROLE_ID, ROLE_GENERAL_ID, ROLE_MANAGEMENT_ID].filter(Boolean);
      const hasSupportRole = allowedRoles.some((rid) => member.roles.cache.has(rid));
      if (!hasSupportRole) {
        return interaction.reply({ content: `${ephemeralEmoji('permission')} Only support staff can set the ticket type.`, flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder()
        .setCustomId('setTicketTypeModal')
        .setTitle('Rename Ticket');

      const input = new TextInputBuilder()
        .setCustomId('newType')
        .setLabel('New name prefix')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., general, management, partnership')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (err) {
      console.error('Error showing Set Ticket Type modal:', err);
      try { await interaction.reply({ content: `${ephemeralEmoji('modal_fail')} Could not open the Set Type modal.`, flags: MessageFlags.Ephemeral }); } catch {}
    }
  }
};