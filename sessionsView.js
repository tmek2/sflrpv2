const { EmbedBuilder, MessageFlags } = require("discord.js");
const { ephemeralEmoji } = require('./utils/emoji');

module.exports = {
	customID: 'sessionView:button',
	execute: async function(interaction, client, args) {
    await interaction.reply({
      content: `${ephemeralEmoji('loading')} Fetching voters...`,
      flags: MessageFlags.Ephemeral
    });

		const sessionId = args[0];
    const votes = args[1];

    const sessionVotes = client.sessions.get(sessionId) || new Map();
    const voters = [...sessionVotes.values()]
      .map(v => `<:sflrpbullet:1434856480707969025> <@${v.user.id}>`)
      .join('\n') || 'No votes yet.';

    await interaction.editReply({
      content: '',
      embeds: [
        new EmbedBuilder()
          .setTitle(`Voters (\`${sessionVotes.size}/${votes}\`)`)
          .setDescription(voters)
          .setColor('#fc2f56')
      ]
    });
	}

}
