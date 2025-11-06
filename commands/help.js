const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands'),
  async execute(interaction) {
    const commandsList = [
      '**Utility Commands**',
      '`/help` - List all commands',
      '`/ping` - Check the bot\'s latency and response time',
      '`/remindme` - Set a reminder',
      '`/suggest` - Suggests something for the server.',
      '`/userinfo` - Get detailed information about a user',
      '`/serverinfo` - Display information about this server',
      '`/avatar` - Show a user\'s avatar',
      '',
      '**Fun**',
      '`/coinflip` - Flip a coin'
    ].join('\n');
    await interaction.reply({ content: commandsList, flags: MessageFlags.Ephemeral });
  }
};