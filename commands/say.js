// commands/say.js
const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { ephemeralEmoji } = require('../utils/emoji');
const { requireRole } = require('../utils/roleGate');
const REQUIRED_ROLE_ID = process.env.SAY_REQUIRED_ROLE_ID || '';
const BANNED_WORDS = ['@here', '@everyone', 'nigger']; // Add banned words here

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message to a channel')
        .addChannelOption(option =>
            option.setName('channel')
                  .setDescription('Channel to send the message')
                  .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                  .setDescription('Message to send')
                  .setRequired(true)
        ),

    async execute(interaction) {
        const ok = await requireRole(interaction, REQUIRED_ROLE_ID);
        if (!ok) return;

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        // Check for banned words (case-insensitive)
        const containsBannedWord = BANNED_WORDS.some(word => message.toLowerCase().includes(word.toLowerCase()));
        if (containsBannedWord) {
            return interaction.reply({ content: `${ephemeralEmoji('error')} Your message contains a banned word and cannot be sent.`, flags: MessageFlags.Ephemeral });
        }

        // Defer reply to avoid "interaction did not respond"
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Send message without replying to interaction
            await channel.send(message);
            await interaction.editReply({ content: `${ephemeralEmoji('success')} Message sent to ${channel}` });
        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: `${ephemeralEmoji('error')} Failed to send message.` });
        }
    },
};