const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { pingEmoji, pingStatusEmoji } = require('../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Check the bot's latency and response time"),

  async execute(interaction) {
    try {
      const start = Date.now();
      // Defer reply to get accurate timing
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const end = Date.now();
      const responseTime = end - start;
      const wsLatency = interaction.client.ws.ping;

      // Determine latency status and color
      let status, color;
      if (wsLatency < 100) {
        status = `${pingStatusEmoji('excellent')} Excellent`;
        color = 0x00FF00;
      } else if (wsLatency < 200) {
        status = `${pingStatusEmoji('good')} Good`;
        color = 0xFFFF00;
      } else if (wsLatency < 300) {
        status = `${pingStatusEmoji('fair')} Fair`;
        color = 0xFF8000;
      } else {
        status = `${pingStatusEmoji('poor')} Poor`;
        color = 0xFF0000;
      }

      const embed = createEmbed({
        title: `${pingEmoji('title')} Pong!`,
        description: 'Bot latency and response time information',
        color: color,
        fields: [
          { name: `${pingEmoji('ws')} WebSocket Latency`, value: `\`${wsLatency}ms\``, inline: true },
          { name: `${pingEmoji('response')} Response Time`, value: `\`${responseTime}ms\``, inline: true },
          { name: `${pingEmoji('status')} Status`, value: status, inline: true }
        ],
        footer: {
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        }
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error executing ping command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while checking latency.'
      });
    }
  },
};
