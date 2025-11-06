const { MessageFlags } = require('discord.js');
const { ephemeralEmoji } = require('./emoji');

async function requireRole(interaction, roleId) {
  if (!roleId) return true;
  try {
    if (!interaction.guild) {
      await interaction.reply({ content: `${ephemeralEmoji('permission')} This command can only be used in a server.`, flags: MessageFlags.Ephemeral });
      return false;
    }
    const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.roles) {
      await interaction.reply({ content: `${ephemeralEmoji('permission')} I couldn’t verify your roles. Try again.`, flags: MessageFlags.Ephemeral });
      return false;
    }
    let required = [];
    if (Array.isArray(roleId)) {
      required = roleId;
    } else if (typeof roleId === 'string') {
      required = roleId.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    } else if (roleId) {
      required = [String(roleId)];
    }

    const ok = required.length === 0 ? true : required.some(id => member.roles.cache.has(id));
    if (!ok) {
      await interaction.reply({ content: `${ephemeralEmoji('permission')} You don’t have permission to use this command.`, flags: MessageFlags.Ephemeral });
    }
    return ok;
  } catch (e) {
    try {
      await interaction.reply({ content: `${ephemeralEmoji('error_generic')} Role check failed: ${e?.message || e}`, flags: MessageFlags.Ephemeral });
    } catch {}
    return false;
  }
}

module.exports = { requireRole };