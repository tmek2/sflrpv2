const { Client, GatewayIntentBits, Events } = require('discord.js');
const { ephemeralEmoji } = require('./utils/emoji');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Lightweight .env loader (no external dependency)
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      const hash = val.indexOf('#');
      if (hash !== -1) val = val.slice(0, hash).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    console.warn('Failed to load .env:', err.message);
  }
}
loadEnv();

// Command and component handlers
const sessions = require('./commands/sessions.js');
const reminder = require('./commands/reminder.js');
const suggestion = require('./commands/suggestion.js');
const ping = require('./commands/ping.js');
const sessionsVote = require('./sessionsVote.js');
const sessionsView = require('./sessionsView.js');
const sessionsRole = require('./sessionsRole.js');
// Dash help system handlers
const dashboardHelp = require('./buttons/dash/dashboardHelp.js');
const claimHelp = require('./buttons/dash/claimHelp.js');
const unclaimHelp = require('./buttons/dash/unclaimHelp.js');
const closeHelp = require('./buttons/dash/closeHelp.js');
const dashboardHelpModal = require('./modals/dash/dashboardHelpModal.js');
const dashboardHelpRetry = require('./buttons/dash/dashboardHelpRetry.js');
const ticketSelect = require('./buttons/dash/ticketSelect.js');
const dashboardTicketModal = require('./modals/dash/dashboardTicketModal.js');
const setTicketType = require('./buttons/dash/setTicketType.js');
const setTicketTypeModal = require('./modals/dash/setTicketTypeModal.js');
const help = require('./commands/help.js');
const userinfo = require('./commands/userinfo.js');
const serverinfo = require('./commands/serverinfo.js');
const avatar = require('./commands/avatar.js');
const coinflip = require('./commands/coinflip.js');
// ER:LC private server logger
const erlcLog = require('./erlclog.js');
// ER:LC on-demand commands (ported and integrated)
const commandlogs = require('./commands/commandlogs.js');
const joinlogs = require('./commands/joinlogs.js');
const killlogs = require('./commands/killlogs.js');
const viewlogs = require('./commands/viewlogs.js');
const erlcserver = require('./commands/erlcserver.js');
const runcmd = require('./commands/runcmd.js');
const { initPrefix } = require('./prefix.js');
const sessionStatusPanel = require('./panels/sessionStatusPanel.js');
// Alias command wrappers to match external naming (keep only undashed aliases)
const playersAlias = require('./commands/players.js');
const killLogsAlias = require('./commands/killlogs.js');
const serverAlias = require('./commands/server.js');
const commandAlias = require('./commands/command.js');
// Lazy-load auto reminder only when configured

// Basic config from environment
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI || '';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || '';
const PRC_KEY = process.env.PRC_KEY || '';

if (!TOKEN) {
  console.error('DISCORD_TOKEN is missing. Set it in your environment.');
  process.exit(1);
}

const { MessageFlags, EmbedBuilder } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Welcome system (ported from welcoming.py)
try {
  const initWelcoming = require('./welcoming.js');
  initWelcoming(client);
} catch (e) {
  console.warn('welcoming.js not loaded:', e.message);
}

client.sessions = new Map();
client.activePollId = null;
client.config = { PRC_KEY };

  client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
    await client.application.commands.set([
      // Utilities
      help.data,
      ping.data,
      reminder.data,
      suggestion.data,
      userinfo.data,
      serverinfo.data,
      avatar.data,
      // ER:LC on-demand (register primary, undashed names)
      playersAlias.data,
      commandlogs.data,
      viewlogs.data,
      killlogs.data,
      joinlogs.data,
      erlcserver.data,
      runcmd.data,
      // Fun
      coinflip.data,
      // Put sessions last (ticket panel is prefix-only via sf!tp)
      sessions.data
    ]);
      console.log('Registered application commands.');
    } catch (err) {
      console.error('Failed to register commands:', err);
    }

    // Start ER:LC logging (requires PRC_KEY and channel IDs)
    try {
      erlcLog.start(client);
      console.log('ER:LC logging initialized.');
    } catch (e) {
      console.warn('Failed to start ER:LC logging:', e?.message || e);
    }

    // Initialize prefix command handler
    try {
      initPrefix(client);
      console.log('Prefix commands initialized.');
    } catch (e) {
      console.warn('Failed to init prefix commands:', e?.message || e);
    }

    // Post or refresh Session Status panel
    try {
      await sessionStatusPanel.start(client);
      console.log('Session Status panel is ready.');
    } catch (e) {
      console.warn('Failed to initialize Session Status panel:', e?.message || e);
    }

    // Start auto reminder scheduler only if a reminder channel is configured
    try {
      const reminderChannelId = process.env.REMINDER_CHANNEL_ID || '';
      if (reminderChannelId) {
        const autoReminder = require('./autoReminder.js');
        autoReminder.start(client);
        console.log('Auto reminder scheduler started.');
      }
    } catch (e) {
      console.warn('Failed to start auto reminder:', e?.message || e);
    }
  });

// Mongo cleanup scheduler
let startCleanupScheduler;
try {
  ({ startCleanupScheduler } = require('./cleanup.js'));
} catch (e) {
  console.warn('cleanup.js not loaded:', e.message);
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      // Send command usage logs to a configured channel, if available
      const logCommandUsage = async () => {
        const logsChannelId = process.env.COMMAND_LOGS_CHANNEL_ID || '';
        if (!logsChannelId) return;
        const logsChannel = interaction.client.channels.cache.get(logsChannelId);
        if (!logsChannel) return;
                const embed = new EmbedBuilder()
                    .setColor(process.env.GLOBAL_EMBED_COLOR || '#fc2f56')
          .setTitle('Command Executed')
          .addFields(
            { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Command', value: `/${interaction.commandName}`, inline: true },
            { name: 'Server', value: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'Direct Message', inline: true },
            { name: 'Timestamp', value: new Date().toLocaleString(), inline: true }
          )
          .setTimestamp();
        try {
          await logsChannel.send({ embeds: [embed] });
        } catch (sendErr) {
          console.warn('Failed to send command log:', sendErr?.message || sendErr);
        }
      };
      if (interaction.commandName === 'sessions') {
        await sessions.execute(interaction, client, []);
        await logCommandUsage();
      } else if (interaction.commandName === 'ticketpanel') {
        await dash.execute(interaction);
        await logCommandUsage();
      } else if (interaction.commandName === 'remindme') {
        await reminder.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'suggest') {
        await suggestion.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'ping') {
        await ping.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'help') {
        await help.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'say') {
        const say = require('./commands/say.js');
        await say.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'userinfo') {
        await userinfo.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'serverinfo') {
        await serverinfo.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'avatar') {
        await avatar.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'players') {
        await playersAlias.execute(interaction);
        await logCommandUsage();
      } else if (interaction.commandName === 'commandlogs') {
        await commandlogs.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'viewlogs') {
        await viewlogs.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'killlogs') {
        await killlogs.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'joinlogs') {
        await joinlogs.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'erlcserver') {
        await erlcserver.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'runcmd') {
        await runcmd.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'id') {
        await id.execute(interaction, client);
        await logCommandUsage();
      } else if (interaction.commandName === 'coinflip') {
        await coinflip.execute(interaction, client);
        await logCommandUsage();
      }
      return;
    }

    if (interaction.isButton()) {
      const base = interaction.customId.split('_')[0];
      const args = interaction.customId.includes('_')
        ? interaction.customId.split('_').slice(1)
        : [];

      if (interaction.customId === suggestion.customIDs.upvote || interaction.customId === suggestion.customIDs.downvote) {
        return suggestion.handleButton(interaction);
      }
      if (base === sessionsVote.customID) return sessionsVote.execute(interaction, client, args);
      if (base === sessionsView.customID) return sessionsView.execute(interaction, client, args);
      if (base === sessionsRole.customID) return sessionsRole.execute(interaction, client, args);
      if (base === dashboardHelp.customID) return dashboardHelp.execute(interaction);
      if (base === dashboardHelpRetry.customID) return dashboardHelpRetry.execute(interaction);
      if (base === claimHelp.customID) return claimHelp.execute(interaction);
      if (base === unclaimHelp.customID) return unclaimHelp.execute(interaction);
      if (base === closeHelp.customID) return closeHelp.execute(interaction);
      if (base === setTicketType.customID) return setTicketType.execute(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === ticketSelect.customID) {
        return ticketSelect.execute(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === dashboardHelpModal.customID) return dashboardHelpModal.execute(interaction);
      if (Array.isArray(dashboardTicketModal.customIDs) && dashboardTicketModal.customIDs.includes(interaction.customId)) {
        return dashboardTicketModal.execute(interaction);
      }
      if (interaction.customId === setTicketTypeModal.customID) {
        return setTicketTypeModal.execute(interaction);
      }
      if (interaction.customId === 'closeModal') {
        // Lazy load to avoid requiring optional dependency at startup
        const closeHelpModal = require('./modals/dash/closeHelpModal.js');
        return closeHelpModal.execute(interaction);
      }
    }
  } catch (err) {
    console.error('Interaction error:', err);
      try { if (!interaction.replied) await interaction.reply({ content: `${ephemeralEmoji('error')} An error occurred.`, flags: MessageFlags.Ephemeral }); } catch {}
  }
});

(async () => {
  try {
    if (MONGO_URI) {
      mongoose.connection.on('connected', () => console.log('MongoDB connected'));
      mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
      mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

      const connOpts = {
        serverSelectionTimeoutMS: 8000,
        dbName: MONGO_DB_NAME || undefined
      };

      await mongoose.connect(MONGO_URI, connOpts);
      console.log('Connected to MongoDB');

      // Start scheduled MongoDB cleanup after successful connection
      if (typeof startCleanupScheduler === 'function') {
        startCleanupScheduler();
      }
    } else {
      console.log('MONGO_URI not set; ticket persistence will be skipped.');
    }
  } catch (err) {
    console.warn('MongoDB connection failed:', err.message);
  }
  await client.login(TOKEN);
})();

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));
