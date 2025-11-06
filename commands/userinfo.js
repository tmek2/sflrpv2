const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { ephemeralEmoji } = require('../utils/emoji');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get detailed information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!member) {
                await interaction.reply({
                    content: `${ephemeralEmoji('not_found')} User not found in this server.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            
            // Calculate account age
            const accountCreated = targetUser.createdAt;
            const joinedServer = member.joinedAt;
            const now = new Date();
            
            const accountAge = Math.floor((now - accountCreated) / (1000 * 60 * 60 * 24));
            const serverAge = joinedServer ? Math.floor((now - joinedServer) / (1000 * 60 * 60 * 24)) : 'Unknown';
            
            // Get roles (excluding @everyone)
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(role => `<@&${role.id}>`)
                .slice(0, 10); // Limit to 10 roles to prevent embed overflow
            
            // Get key permissions
            const keyPermissions = [];
            const permissions = member.permissions;
            
            if (permissions.has(PermissionFlagsBits.Administrator)) keyPermissions.push('Administrator');
            if (permissions.has(PermissionFlagsBits.ManageGuild)) keyPermissions.push('Manage Server');
            if (permissions.has(PermissionFlagsBits.ManageRoles)) keyPermissions.push('Manage Roles');
            if (permissions.has(PermissionFlagsBits.ManageChannels)) keyPermissions.push('Manage Channels');
            if (permissions.has(PermissionFlagsBits.ManageMessages)) keyPermissions.push('Manage Messages');
            if (permissions.has(PermissionFlagsBits.KickMembers)) keyPermissions.push('Kick Members');
            if (permissions.has(PermissionFlagsBits.BanMembers)) keyPermissions.push('Ban Members');
            
            // User status and activities
            const presence = member.presence;
            const status = presence?.status || 'offline';
            const statusEmoji = {
                online: '🟢',
                idle: '🟡',
                dnd: '🔴',
                offline: '⚫'
            };
            
            // Custom activities
            const activities = presence?.activities?.filter(activity => activity.type !== 4) || [];
            const customStatus = presence?.activities?.find(activity => activity.type === 4);
            
            const embed = createEmbed({
                title: `📋 User Information`,
                color: member.displayHexColor !== '#000000' ? member.displayHexColor : 0x0099FF,
                thumbnail: targetUser.displayAvatarURL({ dynamic: true, size: 256 }),
                fields: [
                    {
                        name: '👤 Basic Info',
                        value: [
                            `**Username:** ${targetUser.tag}`,
                            `**Display Name:** ${member.displayName}`,
                            `**ID:** \`${targetUser.id}\``,
                            `**Bot:** ${targetUser.bot ? 'Yes' : 'No'}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📅 Dates',
                        value: [
                            `**Account Created:** <t:${Math.floor(accountCreated.getTime() / 1000)}:R>`,
                            `**Joined Server:** ${joinedServer ? `<t:${Math.floor(joinedServer.getTime() / 1000)}:R>` : 'Unknown'}`,
                            `**Account Age:** ${accountAge} days`,
                            `**Server Age:** ${serverAge !== 'Unknown' ? `${serverAge} days` : 'Unknown'}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📊 Status',
                        value: [
                            `**Status:** ${statusEmoji[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                            `**Custom Status:** ${customStatus?.state || 'None'}`,
                            `**Activities:** ${activities.length > 0 ? activities.map(a => a.name).join(', ') : 'None'}`
                        ].join('\n'),
                        inline: false
                    }
                ],
                footer: {
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                }
            });
            
            // Add roles field if user has roles
            if (roles.length > 0) {
                embed.addFields({
                    name: `🎭 Roles [${member.roles.cache.size - 1}]`,
                    value: roles.join(' ') + (member.roles.cache.size > 11 ? '\n*...and more*' : ''),
                    inline: false
                });
            }
            
            // Add key permissions field if user has any
            if (keyPermissions.length > 0) {
                embed.addFields({
                    name: '🔑 Key Permissions',
                    value: keyPermissions.join(', '),
                    inline: false
                });
            }
            
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            
        } catch (error) {
            console.error('Error executing userinfo command:', error);
            await interaction.reply({
                content: `${ephemeralEmoji('error')} An error occurred while fetching user information.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};