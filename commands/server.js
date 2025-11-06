const { SlashCommandBuilder } = require('discord.js');
const erlcserver = require('./erlcserver');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('View ER:LC private server status (alias).'),
  async execute(interaction) {
    return erlcserver.execute(interaction);
  },
};