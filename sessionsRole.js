// Role to toggle via the Sessions button, sourced from .env
const roleId = process.env.SESSIONS_TOGGLE_ROLE_ID || '';
const { ephemeralEmoji } = require('./utils/emoji');
const { MessageFlags } = require('discord.js');

module.exports = {
	customID: 'sessionsRole:button',
	execute: async function(interaction, client, args) {
		const { guild, member } = interaction;
	const role = await guild.roles.fetch(roleId);

	// If no role is configured, inform the user (kept ephemeral to avoid noise)
	if (!roleId || !role) {
    return interaction.reply({
      content: `${ephemeralEmoji('config')} Session toggle role is not configured. Ask an admin to set SESSIONS_TOGGLE_ROLE_ID in .env.`,
      flags: MessageFlags.Ephemeral
    });
	}

		const roles = member.roles;
		if (!roles.cache.has(roleId)) {
			roles.add(role);
            await interaction.reply({
                content: `${ephemeralEmoji('success_add')} Successfully gave ${role}!`,
                flags: MessageFlags.Ephemeral
            });
		} else {
			roles.remove(role);
            await interaction.reply({
                content: `${ephemeralEmoji('success_remove')} Successfully removed ${role}!`,
                flags: MessageFlags.Ephemeral
            });
		}
	}
}