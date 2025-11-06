const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { ephemeralEmoji } = require('../utils/emoji');

function parseDelay(text) {
  // e.g. 10, 10s, 10m, 1h, 1d
  const m = /^([0-9]+)\s*([smhd]?)$/i.exec(String(text).trim());
  if (!m) return null;
  const amount = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  let seconds = amount;
  if (unit === 'm') seconds = amount * 60;
  else if (unit === 'h') seconds = amount * 3600;
  else if (unit === 'd') seconds = amount * 86400;
  return seconds;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a reminder')
    .addStringOption(opt => opt
      .setName('time')
      .setDescription('Time like 10m, 1h, 30s')
      .setRequired(true)
    )
    .addStringOption(opt => opt
      .setName('message')
      .setDescription('Reminder message')
      .setRequired(true)
    ),

  execute: async function(interaction, client) {
    const time = interaction.options.getString('time', true);
    const message = interaction.options.getString('message', true);

    const seconds = parseDelay(time);
    if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
      return interaction.reply({ content: `${ephemeralEmoji('error')} Invalid time format. Example: \`10m\` or \`1h\`.`, flags: MessageFlags.Ephemeral });
    }

    // Ephemeral confirmation to the command
    await interaction.reply({ content: `${ephemeralEmoji('success')} I will remind you in ${time}.`, flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    setTimeout(async () => {
      try {
        const user = await client.users.fetch(userId);
        await user.send(`Reminder: ${message}`);
      } catch (dmErr) {
        try {
          const channel = await client.channels.fetch(channelId);
          await channel.send(`<@${userId}>, Reminder: ${message}`);
        } catch (sendErr) {
          // Swallow final errors; nothing else we can do
          console.warn('remindme: failed to deliver reminder:', sendErr?.message || sendErr);
        }
      }
    }, seconds * 1000);
  }
};