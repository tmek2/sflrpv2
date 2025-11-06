const { ephemeralEmoji } = require('../../utils/emoji');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const DashboardHelpTicket = require('../../models/dashboardHelpSchema');

const SUPPORT_ROLE_ID = process.env.HELP_SUPPORT_ROLE_ID || '';
const ROLE_GENERAL_ID = process.env.HELP_SUPPORT_ROLE_GENERAL_ID || '';
const ROLE_MANAGEMENT_ID = process.env.HELP_SUPPORT_ROLE_MANAGEMENT_ID || '';
// Only general and management ticket types are supported

function sanitizeType(input) {
  const trimmed = (input || '').trim().toLowerCase();
  const hyphenated = trimmed.replace(/\s+/g, '-');
  const cleaned = hyphenated.replace(/[^a-z0-9-]/g, '');
  return cleaned.replace(/-+/g, '-').slice(0, 40);
}

module.exports = {
  customID: 'setTicketTypeModal',

  async execute(interaction) {
    try {
      const member = interaction.member;
      // Support multiple role IDs provided via commas or spaces
      const allowedRoles = [
        ...String(SUPPORT_ROLE_ID).split(/[,\s]+/),
        ...String(ROLE_GENERAL_ID).split(/[,\s]+/),
        ...String(ROLE_MANAGEMENT_ID).split(/[,\s]+/)
      ].filter(Boolean);
      const hasSupportRole = allowedRoles.some((rid) => member.roles.cache.has(rid));
      if (!hasSupportRole) {
        return interaction.reply({ content: `${ephemeralEmoji('permission')} Only support staff can rename the ticket.`, flags: MessageFlags.Ephemeral });
      }

      const newTypeRaw = interaction.fields.getTextInputValue('newType');
      const newType = sanitizeType(newTypeRaw);
      if (!newType) {
        return interaction.reply({ content: `${ephemeralEmoji('modal_fail_retry')} Enter a valid name prefix (letters, numbers, hyphens).`, flags: MessageFlags.Ephemeral });
      }

      const channel = interaction.channel;
      if (!channel || !channel.name) {
        return interaction.reply({ content: `${ephemeralEmoji('not_found')} Could not locate the ticket channel.`, flags: MessageFlags.Ephemeral });
      }

      const current = channel.name;
      const dashIdx = current.indexOf('-');
      const suffix = dashIdx !== -1 ? current.slice(dashIdx + 1) : current;
      const newName = `${newType}-${suffix}`;

      try {
        await channel.setName(newName, `Support set ticket type to '${newType}'`);

        const dbConnected = mongoose.connection && mongoose.connection.readyState === 1;
        if (dbConnected) {
          const ticket = await DashboardHelpTicket.findOne({ channelId: channel.id });
          if (ticket) {
            ticket.type = newType;
            await ticket.save();

            // Do not alter channel permissions on rename; keep existing support access
          }
        }

        return interaction.reply({ content: `${ephemeralEmoji('created')} Ticket renamed: <#${channel.id}>`, flags: MessageFlags.Ephemeral });
      } catch (err) {
        console.error('Error renaming ticket channel:', err);
        return interaction.reply({ content: `${ephemeralEmoji('modal_fail')} Failed to rename the channel.`, flags: MessageFlags.Ephemeral });
      }
    } catch (err) {
      console.error('Error handling Set Ticket Type modal:', err);
      try { await interaction.reply({ content: `${ephemeralEmoji('error')} An error occurred while updating the ticket type.`, flags: MessageFlags.Ephemeral }); } catch {}
    }
  }
};
