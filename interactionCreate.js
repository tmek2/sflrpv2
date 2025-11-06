const { Interaction, Permissions, EmbedBuilder, CommandInteraction, ButtonInteraction, InteractionType, MessageFlags } = require("discord.js");
const chalk = require("chalk");
const config = require('../../../config.json');
const path = require('path');
const fs = require('fs');

const errorsDir = path.join(__dirname, '../../../errors');

function ensureErrorDirectoryExists() {
    if (!fs.existsSync(errorsDir)) {
        fs.mkdirSync(errorsDir);
    }
}

function logErrorToFile(error) {
    try {
        // Check if error logging is enabled in discobase.json
        const discobasePath = path.join(__dirname, '../discobase.json');
        if (fs.existsSync(discobasePath)) {
            const discobaseConfig = JSON.parse(fs.readFileSync(discobasePath, 'utf8'));
            if (discobaseConfig.errorLogging && discobaseConfig.errorLogging.enabled === false) {
                // Error logging is disabled, do nothing
                return;
            }
        }

        ensureErrorDirectoryExists();

        // Convert the error object into a string, including the stack trace
        const errorMessage = `${error.name}: ${error.message}\n${error.stack}`;

        const fileName = `${new Date().toISOString().replace(/:/g, '-')}.txt`;
        const filePath = path.join(errorsDir, fileName);

        fs.writeFileSync(filePath, errorMessage, 'utf8');
    } catch (err) {
        // If there's an error while logging the error, just silently fail
        // We don't want errors in error logging to cause more issues
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.log(chalk.yellow(`Command "${interaction.commandName}" not found.`));
                return;
            }

            if (command.adminOnly) {
                if (!config.bot.admins.includes(interaction.user.id)) {

                    const embed = new EmbedBuilder()
                        .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                        .setDescription(`\`❌\` | This command is admin-only. You cannot run this command.`)

                    return await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if (command.ownerOnly) {
                if (interaction.user.id !== config.bot.ownerId) {
                    const embed = new EmbedBuilder()
                        .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                        .setDescription(`\`❌\` | This command is owner-only. You cannot run this command.`)

                    return await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if (command.userPermissions) {
                const memberPermissions = interaction.member.permissions;
                const missingPermissions = command.userPermissions.filter(perm => !memberPermissions.has(perm));

                if (missingPermissions.length) {
                    const embed = new EmbedBuilder()
                        .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                        .setDescription(`\`❌\` | You lack the necessary permissions to execute this command: \`\`\`${missingPermissions.join(", ")}\`\`\``)

                    return await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if (command.requiredRoles && command.requiredRoles.length > 0) {
                const memberRoles = interaction.member.roles.cache;
                const hasRequiredRole = command.requiredRoles.some(roleId => memberRoles.has(roleId));

                if (!hasRequiredRole) {
                    const embed = new EmbedBuilder()
                        .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                        .setDescription(`\`❌\` | You don't have the required role(s) to use this command.`);

                    return await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            if (command.botPermissions) {
                const botPermissions = interaction.guild.members.me.permissions;
                const missingBotPermissions = command.botPermissions.filter(perm => !botPermissions.has(perm));
                if (missingBotPermissions.length) {
                    const embed = new EmbedBuilder()
                        .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                        .setDescription(`\`❌\` | I lack the necessary permissions to execute this command: \`\`\`${missingBotPermissions.join(", ")}\`\`\``)

                    return await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }


            if (command.disabled) {
                    const embed = new EmbedBuilder()
                        .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                    .setDescription(`\`⛔\` | This command is currently disabled. Please try again later.`);

                return await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }



            const cooldowns = client.cooldowns || new Map();
            const now = Date.now();
            const cooldownAmount = (command.cooldown || 3) * 1000;
            const timestamps = cooldowns.get(command.name) || new Map();

            if (timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;

                    const embed = new EmbedBuilder()
                    .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                        .setDescription(`\`❌\` | Please wait **${timeLeft.toFixed(1)}** more second(s) before reusing the command.`)

                    return await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            timestamps.set(interaction.user.id, now);
            cooldowns.set(command.name, timestamps);

            try {
                await command.execute(interaction, client);
                // Command logging code...
                const logEmbed = new EmbedBuilder()
                    .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
                    .setTitle('Command Executed')
                    .addFields(
                        { name: 'User', value: `${interaction.user.tag}(${interaction.user.id})`, inline: true },
                        { name: 'Command', value: `/${command.data.name}`, inline: true },
                        {
                            name: 'Server',
                            value: interaction.guild
                                ? `${interaction.guild.name} (${interaction.guild.id})`
                                : 'Direct Message',
                            inline: true
                        },
                        { name: 'Timestamp', value: new Date().toLocaleString(), inline: true }
                    )
                    .setTimestamp();

                if (config.logging.commandLogsChannelId) {
                    if (config.logging.commandLogsChannelId === 'COMMAND_LOGS_CHANNEL_ID') return;
                    const logsChannel = client.channels.cache.get(config.logging.commandLogsChannelId);
                    if (logsChannel) {
                        await logsChannel.send({ embeds: [logEmbed] });
                    } else {
                        console.error(chalk.yellow(`Logs channel with ID ${config.logging.commandLogsChannelId} not found.`));
                    }
                }
            } catch (error) {
                console.error(chalk.red(`Error executing command "${command.data.name}": `), error);
                logErrorToFile(error);
                if (!interaction.replied && !interaction.deferred) {
                    interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral }).catch(err => console.error('Failed to send error response:', err));
                }
            }

        }
        // Handle Components V2 interactions (button/select) with known custom_ids
        else if (interaction.isButton() && interaction.customId === 'p_229585203004182560') {
            try {
                await interaction.reply({ content: 'hi!', flags: MessageFlags.Ephemeral });
            } catch (error) {
                console.error('Failed to respond to Support button:', error);
                logErrorToFile(error);
            }
        } else if (interaction.isStringSelectMenu() && interaction.customId === 'p_229587640293265442') {
            try {
                await interaction.reply({ content: 'hi!', flags: MessageFlags.Ephemeral });
            } catch (error) {
                console.error('Failed to respond to select menu:', error);
                logErrorToFile(error);
            }
        }
        else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.type === InteractionType.ModalSubmit || interaction.isContextMenuCommand()) {
            // Generic component routing with prefix matching and args parsing
            const id = interaction.customId;
            let handler = null;
            let args = [];

            // Exact match or prefix match like: "prefix_arg1_arg2"
            for (const [key, comp] of client.components) {
                if (id === key) {
                    handler = comp;
                    break;
                }
                const prefix = key + '_';
                if (id.startsWith(prefix)) {
                    handler = comp;
                    args = id.slice(prefix.length).split('_');
                    break;
                }
            }

            if (!handler) {
                console.log(chalk.yellow(`Component with customId "${id}" not found.`));
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'This interaction is no longer available.', flags: MessageFlags.Ephemeral }).catch(console.error);
                }
                return;
            }

            try {
                await handler.execute(interaction, client, args);
            } catch (error) {
                console.error(chalk.red(`Error executing component "${id}": `), error);
                logErrorToFile(error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Something went wrong while executing this interaction.', flags: MessageFlags.Ephemeral }).catch(err => console.error('Failed to send error response:', err));
                }
            }
        }
    },
};
