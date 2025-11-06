const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show a user's avatar")
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to show avatar for')
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: 'png' });
    await interaction.reply({ content: `${user}’s Avatar:\n${url || 'No avatar'}`, flags: MessageFlags.Ephemeral });
  }
};