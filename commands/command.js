const { SlashCommandBuilder } = require('discord.js');
const runcmd = require('./runcmd');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('command')
    .setDescription('Run a command on ER:LC private server (alias).')
    .addStringOption(opt =>
      opt.setName('cmd')
        .setDescription('Command to run (e.g., :kick <user>)')
        .setRequired(true)
    ),
  async execute(interaction) {
    return runcmd.execute(interaction);
  },
};