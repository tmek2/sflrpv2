const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags
  } = require('discord.js');
  const Ticket = require('../../models/dashboardHelpSchema');
  const mongoose = require('mongoose');
  const { getRobloxAccount } = require('../../utils/BloxlinkApi');
  const { ephemeralEmoji } = require('../../utils/emoji');

  // Help system settings sourced from .env
  const SUPPORT_ROLE_ID = process.env.HELP_SUPPORT_ROLE_ID || ''; // Global support role fallback
  const HELP_SUPPORT_ROLE_GENERAL_ID = process.env.HELP_SUPPORT_ROLE_GENERAL_ID || '';
  const TICKET_CATEGORY_ID = process.env.HELP_CATEGORY_ID || ''; // Default category where help tickets are created
  const HELP_IMAGE_URL = process.env.HELP_IMAGE_URL || ''; // Optional image URL for help embed
  const HELP_THUMBNAIL_URL = process.env.HELP_THUMBNAIL_URL || ''; // Optional thumbnail URL for help embed
  // Reuse ticket panel images for help embed visuals
  const TICKET_PANEL_IMAGE_1_URL = process.env.TICKET_PANEL_IMAGE_1_URL || '';
  const TICKET_PANEL_IMAGE_2_URL = process.env.TICKET_PANEL_IMAGE_2_URL || '';
  // Optional large images for the 3 embeds (top image, text-only, fields-only)
  const TICKET_EMBED_IMAGE_TOP_URL = process.env.TICKET_EMBED_IMAGE_TOP_URL || TICKET_PANEL_IMAGE_2_URL || HELP_IMAGE_URL || '';
  const TICKET_EMBED_IMAGE_TEXT_URL = process.env.TICKET_EMBED_IMAGE_TEXT_URL || '';
  const TICKET_EMBED_IMAGE_FIELDS_URL = process.env.TICKET_EMBED_IMAGE_FIELDS_URL || '';
  const HELP_COLOR = process.env.HELP_COLOR || '#2b2d31'; // Embed color for help tickets
  const GLOBAL_EMBED_COLOR = process.env.GLOBAL_EMBED_COLOR || '#fc2f56';
  const EMBED_COLOR = GLOBAL_EMBED_COLOR || HELP_COLOR;
  
  module.exports = {
    customID: 'dashboardHelpModal',

    async execute(interaction) {
      try {
        // Ensure DB connectivity to enforce ticket limits and persistence
        async function ensureDb(timeoutMs = 8000) {
          if (!process.env.MONGO_URI) return false;
          if (mongoose.connection.readyState === 1) return true; // connected
          try {
            const uri = process.env.MONGO_URI;
            const tlsEnv = String(process.env.MONGO_TLS || '').toLowerCase();
            const tlsOn = tlsEnv === 'true' || /mongodb\.net|mongodb\+srv:/i.test(uri || '');
            const allowInvalid = String(process.env.MONGO_TLS_ALLOW_INVALID || 'false').toLowerCase() === 'true';
            const isSrv = /mongodb\+srv:/i.test(uri || '');
            const connOpts = {
              serverSelectionTimeoutMS: timeoutMs,
              dbName: process.env.MONGO_DB_NAME || undefined,
              tls: tlsOn,
              ssl: tlsOn,
              tlsAllowInvalidCertificates: allowInvalid
            };
            if (!isSrv) connOpts.directConnection = true;
            await mongoose.connect(uri, connOpts);
            return mongoose.connection.readyState === 1;
          } catch (err) {
            console.warn('MongoDB connect attempt failed:', err?.message || err);
            return false;
          }
        }
        const reason = interaction.fields.getTextInputValue('dashboardInquiryReason');

        // Basic fuzzy matching helpers
        function levenshtein(a, b) {
          const m = a.length, n = b.length;
          const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
          for (let i = 0; i <= m; i++) dp[i][0] = i;
          for (let j = 0; j <= n; j++) dp[0][j] = j;
          for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
              const cost = a[i - 1] === b[j - 1] ? 0 : 1;
              dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
              );
            }
          }
          return dp[m][n];
        }

        function fuzzyIncludes(text, keywords) {
          const normalized = text.toLowerCase();
          const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
          for (const kw of keywords) {
            const lkw = kw.toLowerCase();
            if (normalized.includes(lkw)) return true;
            const threshold = Math.max(1, Math.ceil(lkw.length * 0.3));
            for (const t of tokens) {
              if (Math.abs(t.length - lkw.length) > threshold) continue;
              const dist = levenshtein(t, lkw);
              if (dist <= threshold) return true;
            }
          }
          return false;
        }

        const ticketType = 'general';

        // Enforce per-user open ticket limit (max 2)
        const opener = interaction.user;
        const dbReady = await ensureDb();
        if (!dbReady) {
          return interaction.reply({ content: `${ephemeralEmoji('db_down')} Ticket system is currently unavailable. Please try again later.`, flags: MessageFlags.Ephemeral });
        }

        const openCount = await Ticket.countDocuments({ userId: opener.id, status: 'open' }).catch(() => 0);
        if (openCount >= 2) {
          return interaction.reply({ content: `${ephemeralEmoji('limit_reached')} Ticket limit reached, unable to open more tickets.`, flags: MessageFlags.Ephemeral });
        }

        await interaction.reply({ content: `${ephemeralEmoji('creating')} Your ticket is being created.`, flags: MessageFlags.Ephemeral });
        const roblox = await getRobloxAccount(interaction.guild.id, opener.id);

        const guild = interaction.guild;
        const roleMap = {
          general: HELP_SUPPORT_ROLE_GENERAL_ID || SUPPORT_ROLE_ID
        };
        const supportRoleId = roleMap[ticketType] || SUPPORT_ROLE_ID;
        const ticketCategoryId = TICKET_CATEGORY_ID;
        const namePrefix = 'general';
        const channelName = `${namePrefix}-${opener.username}`;
  
        const overwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: opener.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          }
        ];
        if (supportRoleId) {
          overwrites.push({
            id: supportRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          });
        }

        const createOpts = {
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites: overwrites
        };
        if (ticketCategoryId) {
          const parentChannel = guild.channels.cache.get(ticketCategoryId);
          if (parentChannel && parentChannel.type === ChannelType.GuildCategory) {
            createOpts.parent = parentChannel.id;
          }
        }

        const ticketChannel = await guild.channels.create(createOpts);
  
        const ticketId = ticketChannel.id;
  
        const intro = 'Thank you for reaching out to SFLRP Support. Please be patient as our team looks into your ticket. We kindly ask that you don’t mention or tag any staff members while we work on your issue.';
        const note = "```Please note that creating tickets without a real reason or using them to troll will lead to strict moderation. We want to keep the community friendly and respectful for everyone. Thanks for following the rules and understanding. ```";
        const userInfo = [
          `**User:** <@${opener.id}>`,
          `**Roblox User:** ${roblox && roblox.username ? roblox.username : 'Not Linked'}`,
          `**Profile:** ${roblox && roblox.link ? roblox.link : 'N/A'}`,
          `**Account Age:** ${roblox && roblox.ageDays != null ? roblox.ageDays + ' days' : 'N/A'}`
        ].join('\n');
        // Embed 1: image-only (large image)
        const imageEmbed = new EmbedBuilder().setColor(EMBED_COLOR);
        if (TICKET_EMBED_IMAGE_TOP_URL) imageEmbed.setImage(TICKET_EMBED_IMAGE_TOP_URL);

        // Embed 2: text-only, no fields, '> ' prefix for intro paragraph (no Inquiry here)
        const textEmbed = new EmbedBuilder()
          .setDescription(`> ${intro}\n\n${note}\n\n${userInfo}`)
          .setColor(EMBED_COLOR);
        if (TICKET_EMBED_IMAGE_TEXT_URL) textEmbed.setImage(TICKET_EMBED_IMAGE_TEXT_URL);

        // Embed 3: fields-only with Inquiry as a non-inline field above
        const fieldsEmbed = new EmbedBuilder()
          .addFields(
            { name: 'Inquiry', value: String(reason || 'N/A'), inline: false },
            { name: 'Ticket Type', value: ticketType, inline: true },
            { name: 'Opened By', value: `<@${opener.id}>`, inline: true }
          )
          .setColor(EMBED_COLOR)
          .setTimestamp();
        if (TICKET_EMBED_IMAGE_FIELDS_URL) fieldsEmbed.setImage(TICKET_EMBED_IMAGE_FIELDS_URL);
  
        const claimButton = new ButtonBuilder()
          .setLabel('Claim')
          .setCustomId('claimHelp')
          .setStyle(ButtonStyle.Primary);

        const setTypeButton = new ButtonBuilder()
          .setLabel('Rename')
          .setCustomId('setTicketType')
          .setStyle(ButtonStyle.Secondary);

        const closeButton = new ButtonBuilder()
          .setLabel('Close')
          .setCustomId('closeHelp')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(claimButton, setTypeButton, closeButton);
  
        const embedsToSend = imageEmbed.data.image ? [imageEmbed, textEmbed, fieldsEmbed] : [textEmbed, fieldsEmbed];
        await ticketChannel.send({ content: `<@${opener.id}> | @here`, embeds: embedsToSend, components: [row] });

        // Persist ticket data if MongoDB is connected; avoid buffered timeouts

        if (await ensureDb()) {
          try {
            await Ticket.create({
              userId: opener.id,
              username: opener.username,
              channelId: ticketChannel.id,
              reason,
              type: ticketType,
              status: 'open',
              createdAt: new Date(),
              claimedBy: null,
              closedBy: null,
              ticketId
            });
          } catch (err) {
            console.warn('Ticket persistence failed:', err.message);
          }
        } else {
          console.warn('Ticket persistence skipped: MongoDB not connected.');
        }
  
        await interaction.editReply({ content: `${ephemeralEmoji('created')} Your ticket has been successfully created - <#${ticketChannel.id}>` });

    } catch (error) {
      console.error('Error creating ticket from modal:', error);
      try {
        await interaction.editReply({ content: `${ephemeralEmoji('error')} An error occurred while creating the ticket.` });
      } catch {}
    }
  }
};
