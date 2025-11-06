const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ephemeralEmoji } = require('./utils/emoji');

module.exports = {
	customID: 'sessionVote:button',
	execute: async function(interaction, client, args) {
		const sessionId = args[0];
    const votes = args[1];
    const voter = interaction.user;

		if (!client.sessions.has(sessionId)) {
      client.sessions.set(sessionId, new Map());
      client.activePollId = sessionId;
    }

		const sessionVotes = client.sessions.get(sessionId);

		if (sessionVotes.has(voter.id)) {
      sessionVotes.delete(voter.id);

      const leavevoteCount = sessionVotes.size;
      const leavepollVoteButton = new ButtonBuilder()
        .setCustomId(`sessionVote:button_${sessionId}_${votes}`)
        .setLabel(`Vote (${leavevoteCount}/${votes})`)
        .setStyle(ButtonStyle.Success);

      const leavepollViewVoteButton = new ButtonBuilder()
        .setCustomId(`sessionView:button_${sessionId}_${votes}`)
        .setLabel(`View Voters`)
        .setStyle(ButtonStyle.Secondary);

      const leavepollButtons = new ActionRowBuilder().addComponents(leavepollVoteButton, leavepollViewVoteButton);
      await interaction.update({ components: [leavepollButtons] });
      await interaction.followUp({ content: `${ephemeralEmoji('vote_removed')} ${voter}, your vote has been removed!`, flags: MessageFlags.Ephemeral });
    } else {
      sessionVotes.set(voter.id, { user: voter });

      const joinvoteCount = sessionVotes.size;
      const joinpollVoteButton = new ButtonBuilder()
        .setCustomId(`sessionVote:button_${sessionId}_${votes}`)
        .setLabel(`Vote (${joinvoteCount}/${votes})`)
        .setStyle(ButtonStyle.Success);

      const joinpollViewVoteButton = new ButtonBuilder()
        .setCustomId(`sessionView:button_${sessionId}_${votes}`)
        .setLabel(`View Voters`)
        .setStyle(ButtonStyle.Secondary);

      const joinpollButtons = new ActionRowBuilder().addComponents(joinpollVoteButton, joinpollViewVoteButton);
      await interaction.update({ components: [joinpollButtons] });
      await interaction.followUp({ content: `${ephemeralEmoji('vote_added')} Thank you for voting, ${voter}!`, flags: MessageFlags.Ephemeral });
    }
	}
}
