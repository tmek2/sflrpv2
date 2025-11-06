const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { serverInfoEmoji } = require('../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display information about this server'),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const ownerId = guild.ownerId;
    const memberCount = guild.memberCount || (await guild.members.fetch()).size;
    const created = guild.createdAt;

    const embed = createEmbed({
      title: `Server Info: ${guild.name}`,
      thumbnail: guild.iconURL({ dynamic: true }) || undefined,
      fields: [
        { name: `${serverInfoEmoji('id')} Server ID`, value: `\`${guild.id}\``, inline: true },
        { name: `${serverInfoEmoji('owner')} Owner ID`, value: ownerId ? `\`${ownerId}\`` : 'Unknown', inline: true },
        { name: `${serverInfoEmoji('members')} Members`, value: `${memberCount}`, inline: true },
        { name: `${serverInfoEmoji('created')} Created`, value: `<t:${Math.floor(created.getTime() / 1000)}:R>`, inline: true },
        { name: `${serverInfoEmoji('boosts')} Boosts`, value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: `${serverInfoEmoji('roles')} Roles`, value: `${guild.roles.cache.size}`, inline: true }
      ]
    });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};