const { AttachmentBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
  const DiscordTranscripts = require('discord-html-transcripts');
  const DashboardHelpTicket = require('../../models/dashboardHelpSchema');
  const mongoose = require('mongoose');
  const { ephemeralEmoji } = require('../../utils/emoji');
  
  const LOG_CHANNEL_ID = process.env.HELP_LOG_CHANNEL_ID || ''; // Optional transcript channel id (existing)
  const DM_FORWARD_CHANNEL_ID = process.env.HELP_DM_FORWARD_CHANNEL_ID || ''; // Channel to also receive the DM copy
  const GLOBAL_EMBED_COLOR = process.env.GLOBAL_EMBED_COLOR || '#fc2f56';
  const HELP_COLOR = GLOBAL_EMBED_COLOR || (process.env.HELP_COLOR || '#2b2d31');
  const CLOSE_DM_TITLE = process.env.CLOSE_DM_TITLE || 'Ticket Closed';
  const CLOSE_LOG_TITLE = process.env.CLOSE_LOG_TITLE || 'Ticket Closed';
  const CLOSE_DM_IMAGE_TOP_URL = process.env.CLOSE_DM_IMAGE_TOP_URL || 'https://media.discordapp.net/attachments/1430646260032999465/1434222024376586514/assistance_sflrp.png?ex=690b7f59&is=690a2dd9&hm=2675e6574cde07b037ba25558429d41f852810d77b3b6cdb8a9b5a621acd692d&=&format=webp&quality=lossless';
  const CLOSE_DM_IMAGE_BOTTOM_URL = process.env.CLOSE_DM_IMAGE_BOTTOM_URL || 'https://media.discordapp.net/attachments/1430646260032999465/1434222027782492170/bottom_sflrp.png?ex=690b7f59&is=690a2dd9&hm=2b93a86a67db6973a1678f8c4e1b3c14e39f0940ab9b399793988796c6617631&=&format=webp&quality=lossless&width=1768&height=98';
  const CLOSE_LOG_IMAGE_URL = process.env.CLOSE_LOG_IMAGE_URL || '';
  
  module.exports = {
    customID: 'closeModal',
  
    async execute(interaction) {
      const channel = interaction.channel;
      const closer = interaction.user;
      const reason = interaction.fields.getTextInputValue('closeReason') || 'No reason provided.';
  
      try {
        await interaction.reply({
          content: `${ephemeralEmoji('closing')} This ticket is being closed.`,
          flags: MessageFlags.Ephemeral,
        });

        // Avoid buffered DB operations if Mongo is not connected
        const dbConnected = mongoose.connection && mongoose.connection.readyState === 1;
        if (!dbConnected) {
          return interaction.editReply({ content: `${ephemeralEmoji('db_down')} Database not connected — cannot close ticket record.` });
        }
  
        const ticket = await DashboardHelpTicket.findOne({ channelId: channel.id });
        if (!ticket) {
          return interaction.editReply({ content: `${ephemeralEmoji('not_found')} Ticket not found in database.` });
        }
  
        await DashboardHelpTicket.findOneAndUpdate(
          { channelId: channel.id },
          {
            status: 'closed',
            closedBy: closer.id,
            closeReason: reason,
          }
        );
  
        const transcript = await DiscordTranscripts.createTranscript(channel, {
          limit: -1,
          returnType: 'buffer',
          filename: `${ticket.username}-${ticket.ticketId}.html`,
          saveImages: true
        });
  
        const transcriptFile = new AttachmentBuilder(transcript, {
          name: `${ticket.username}-${ticket.ticketId}.html`,
        });
  
        const dmEmbed = new EmbedBuilder()
          .setTitle(CLOSE_DM_TITLE)
          .setColor(HELP_COLOR)
          .setDescription('Your support ticket has been closed.')
          .addFields(
            { name: 'Closure Reason', value: reason, inline: true },
            { name: 'Closed By', value: `<@${closer.id}>`, inline: true }
          )
          .setFooter({ text: `Ticket ID: ${ticket.ticketId}` })
          .setTimestamp();
        // Text-only DM embed: no images
  
        const logEmbed = new EmbedBuilder()
          .setTitle(CLOSE_LOG_TITLE)
          .setColor(HELP_COLOR)
          .addFields(
            { name: 'Closure Reason', value: reason, inline: true },
            { name: 'Closed By', value: `<@${closer.id}>`, inline: true },
          )
          .setFooter({ text: `User ID: ${ticket.userId} | Ticket ID: ${ticket.ticketId}` })
          .setTimestamp();
        if (CLOSE_LOG_IMAGE_URL) logEmbed.setImage(CLOSE_LOG_IMAGE_URL);
  
        const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

        if (logChannel?.isTextBased()) {
          await logChannel.send({
            embeds: [logEmbed],
            files: [transcriptFile]
          });
        }
  
        const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
        if (user) {
          await user.send({ embeds: [dmEmbed] }).catch(() => null);
        }

        // Forward only the text embed (no images) + transcript file to a specific channel if configured
        if (DM_FORWARD_CHANNEL_ID) {
          const forwardChannel = await interaction.client.channels.fetch(DM_FORWARD_CHANNEL_ID).catch(() => null);
          if (forwardChannel?.isTextBased()) {
            // Forward the same text-only embed + transcript file
            await forwardChannel.send({ embeds: [dmEmbed], files: [transcriptFile] }).catch(() => null);
          }
        }
  
        await channel.delete();
  
      } catch (error) {
        console.error('Error closing ticket:', error);
      }
    }
  };
  