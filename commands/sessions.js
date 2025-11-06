const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const crypto = require('crypto');
const { ephemeralEmoji } = require('../utils/emoji');
const axios = require('axios');
const AXIOS_TIMEOUT_MS = Number(process.env.PRC_TIMEOUT_MS || 10000);
const sessionStatusPanel = require('../panels/sessionStatusPanel');
// Fixed server owner username as requested
const FIXED_OWNER_USERNAME = 'KingFridayOfAlzuria';

function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

// Noblox lookup removed; using a fixed, configured username instead

const subBannerUrls = {
  shutdown: 'https://media.discordapp.net/attachments/1055153591280742481/1427732459423793293/sessions_red.png?ex=68efeef8&is=68ee9d78&hm=69878ba123e30c464b65aa990c2f8e8b4739b2260664e7e61c7f497f82b23db2&=&format=webp&quality=lossless&width=1768&height=366',
  full: 'https://media.discordapp.net/attachments/1055153591280742481/1427732458949840896/sessions_green.png?ex=68efeef8&is=68ee9d78&hm=d466258881abc0a70f5a10975d426da6df462df5174993633e3a724d80a25ce0&=&format=webp&quality=lossless&width=1768&height=366',
  boost: 'https://media.discordapp.net/attachments/1055153591280742481/1427732459918983269/sessions_yellow.png?ex=68efeef8&is=68ee9d78&hm=d829af48d8ba84f5fc7eebeee2ee32fe5238eb8c0033ebf89bc5b88d5dbe5cff&=&format=webp&quality=lossless&width=1768&height=366',
  poll: 'https://media.discordapp.net/attachments/1055153591280742481/1427732459918983269/sessions_yellow.png?ex=68efeef8&is=68ee9d78&hm=d829af48d8ba84f5fc7eebeee2ee32fe5238eb8c0033ebf89bc5b88d5dbe5cff&=&format=webp&quality=lossless&width=1768&height=366',
  start: 'https://media.discordapp.net/attachments/1055153591280742481/1427732458949840896/sessions_green.png?ex=68efeef8&is=68ee9d78&hm=d466258881abc0a70f5a10975d426da6df462df5174993633e3a724d80a25ce0&=&format=webp&quality=lossless&width=1768&height=366',
  default: 'https://media.discordapp.net/attachments/1055153591280742481/1427732458949840896/sessions_green.png?ex=68efeef8&is=68ee9d78&hm=d466258881abc0a70f5a10975d426da6df462df5174993633e3a724d80a25ce0&=&format=webp&quality=lossless&width=1768&height=366'
};

function bannerFor(type) {
  return subBannerUrls[type] || subBannerUrls.default;
}
// Read all IDs from .env for easy configuration by non-coders
const SESSIONS_CHANNEL_ID = process.env.SESSIONS_CHANNEL_ID || ''; // Channel where session status is posted
const SESSIONS_PING_ROLE_ID = process.env.SESSIONS_PING_ROLE_ID || ''; // Role to ping in boost/poll/start
const SESSIONS_SHUTDOWN_ROLE_ID = process.env.SESSIONS_SHUTDOWN_ROLE_ID || ''; // Role shown in shutdown description
const SESSIONS_REQUIRED_ROLE_ID = process.env.SESSIONS_REQUIRED_ROLE_ID || ''; // Role required to use /sessions

module.exports = {
	data: new SlashCommandBuilder()
		.setName('sessions')
		.setDescription('Manage sessions')
		.addSubcommand(x => x
			.setName('shutdown')
			.setDescription('Shutdown the session.')
		)
		.addSubcommand(x => x
			.setName('full')
			.setDescription('Mark the session as full.')
		)
		.addSubcommand(x => x
			.setName('boost')
			.setDescription('Boost the session.')
		)
		.addSubcommand(x => x
			.setName('poll')
			.setDescription('Start a session poll.')
			.addNumberOption(x => x
				.setName('votes')
				.setDescription('The amount of votes needed to start a session')
				.setRequired(true)
			)
		)
		.addSubcommand(x => x
			.setName('start')
			.setDescription('Start the session.')
		),
	execute: async function(interaction, client, args) {
		const subcommand = interaction.options.getSubcommand();
    // Fetch the configured sessions channel by ID from .env
    const channel = await client.channels.fetch(SESSIONS_CHANNEL_ID).catch(() => null);
		const user = interaction.user;

		// Simple permission check like the dash command
		const member = interaction.member;
    if (SESSIONS_REQUIRED_ROLE_ID && !member.roles.cache.has(SESSIONS_REQUIRED_ROLE_ID)) {
      return interaction.reply({ content: `${ephemeralEmoji('permission')} You don’t have permission to use /sessions.`, flags: MessageFlags.Ephemeral });
    }

    if (!channel) {
      return interaction.reply({ content: `${ephemeralEmoji('not_found')} Sessions channel not found. Please check configuration.`, flags: MessageFlags.Ephemeral });
    }

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		switch (subcommand) {
			case 'shutdown':
				client.activePollId = null;

				// Attempt to clear recent messages, but don't block on failure
				try {
					await channel.bulkDelete(100);
				} catch (err) {
					console.warn('sessions shutdown: bulkDelete failed:', err?.message || err);
				}

                // Mention role from .env if provided; otherwise use a generic label
                const shutdownRoleMention = SESSIONS_SHUTDOWN_ROLE_ID ? `<@&${SESSIONS_SHUTDOWN_ROLE_ID}>` : 'the relevant role';
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Session Shutdown')
                            .setDescription(`The in-game server is currently shutdown. Please refrain from joining without staff permission. Doing so can and will result in moderation. You can obtain ${shutdownRoleMention} with the button below.`)
                            .setColor('#fb2c04')
                            .setAuthor({ name: `@${user.username}`, iconURL: user.displayAvatarURL() })
                            .setImage(bannerFor('shutdown'))
                    ]
                });

      await interaction.editReply({ content: 'Successfully shutdown session.' });
      // Update session status panel button to Offline (red)
      try { await sessionStatusPanel.setStatus(client, 'offline'); } catch (e) { console.warn('sessions shutdown: status panel update failed:', e?.message || e); }

				axios.post('https://api.policeroleplay.community/v1/server/command', {
					command: ':m SSD commencing soon! Wrap up your roleplays, want more? Join our comms server code: southflrp'
				},
				{
					headers: {
						'server-key': client.config.PRC_KEY,
						'Content-Type': 'application/json'
					},
					timeout: AXIOS_TIMEOUT_MS
				}).catch(err => console.warn('sessions shutdown: PRC announce failed:', err?.message || err));

				setTimeout(() => {
					axios.post('https://api.policeroleplay.community/v1/server/command', {
						command: ':kick all'
					},
					{
						headers: {
							'server-key': client.config.PRC_KEY,
							'Content-Type': 'application/json'
						},
						timeout: AXIOS_TIMEOUT_MS
					}).catch(err => console.warn('sessions shutdown: PRC kick failed:', err?.message || err));
				}, 1000 * 60 * 2);
				break;
			
			case 'full':
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Session Full')
                            .setDescription(`Thank you South Florida for getting us full! Keep trying to join to experience some immersive roleplays. We got full <t:${Math.floor(Date.now() / 1000)}:R>.`)
                            .setColor('#018f1b')
                            .setAuthor({ name: `@${user.username}`, iconURL: user.displayAvatarURL() })
                            .setImage(bannerFor('full'))
                    ]
                });

                await interaction.followUp({ content: `${ephemeralEmoji('success_full')} Successfully marked session as full.`, flags: MessageFlags.Ephemeral });
				break;

			case 'boost':
                // Ping @here plus the configured role if present
                const pingTag = SESSIONS_PING_ROLE_ID ? `<@&${SESSIONS_PING_ROLE_ID}>` : '';
                await channel.send({
                    content: `@here${pingTag ? ` | ${pingTag}` : ''}`,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Session Boost')
                            .setDescription('We are currently in need of some players! Interested in some immersive and and enjoyable roleplays? Make sure to join. You can press the button below to quickly join.')
                            .setColor('#fde446')
                            .setAuthor({ name: `@${user.username}`, iconURL: user.displayAvatarURL() })
                            .setImage(bannerFor('boost'))
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setLabel('Quick Join')
								.setStyle(ButtonStyle.Link)
								.setURL('https://policeroleplay.community/join?code=SouthFLRP&placeId=2534724415')
						)
					]
				});

                await interaction.followUp({ content: `${ephemeralEmoji('success_boost')} Successfully boosted the session.`, flags: MessageFlags.Ephemeral });
				break;

			case 'poll':
				const votes = interaction.options.getNumber('votes');
				const sessionId = generateId();

                // Duplicate the ping tag (matching original behavior) if configured
                const pollPing = SESSIONS_PING_ROLE_ID ? `<@&${SESSIONS_PING_ROLE_ID}>` : '';
                await channel.send({
                    content: pollPing ? `${pollPing} | ${pollPing}` : '@here',
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Session Poll')
                            .setDescription('The HR team has decided to host a session poll. Interested in joining? Make sure to vote with the buttons below. Please note that if you vote, you are required to join within 15 minutes.')
                            .setColor('#fde446')
                            .setAuthor({ name: `@${user.username}`, iconURL: user.displayAvatarURL() })
                            .setImage(bannerFor('poll'))
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`sessionVote:button_${sessionId}_${votes}`)
                                .setLabel(`Vote (0/${votes})`)
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`sessionView:button_${sessionId}_${votes}`)
                                .setLabel('View Voters')
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ]
                });

                await interaction.followUp({ content: `${ephemeralEmoji('success_poll')} Successfully started a poll.`, flags: MessageFlags.Ephemeral });
				break;

			case 'start':
				const activePollId = client.activePollId;
				const voters = client.sessions.get(activePollId);
				let votersList;
				if (!voters || voters.size === 0) {
					votersList = 'No Voters';
				} else {
					const votersArray = [...voters.values()];

					if (Array.isArray(votersArray) && votersArray.length > 0) {
						votersList = votersArray.map((user) => `${user.user}`).join(', ');
					} else {
						votersList = 'No Voters';
					}
				}

				let serverInfo;
				try {
					const res = await axios.get('https://api.policeroleplay.community/v1/server', {
						headers: {
							'server-key': client.config.PRC_KEY,
							'Accept': '*/*'
						},
						timeout: AXIOS_TIMEOUT_MS
					});

					serverInfo = res.data;
				} catch (error) {
					console.warn('sessions start: PRC server info fetch failed:', error?.message || error);
					await interaction.followUp({ content: `${ephemeralEmoji('error_generic')} Unable to fetch server details from PRC right now. Try again in a moment.`, flags: MessageFlags.Ephemeral });
					break;
				}

                const ownerUser = FIXED_OWNER_USERNAME;

				try {
					await channel.bulkDelete(100);
				} catch (err) {
					console.warn('sessions start: bulkDelete failed:', err?.message || err);
				}
                const startPing = SESSIONS_PING_ROLE_ID ? `<@&${SESSIONS_PING_ROLE_ID}>` : '';
                let msg;
                try {
                    msg = await channel.send({
                    content: `@here${startPing ? ` | ${startPing}` : ''}\n-# ${votersList}`,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Session Start')
                            .setDescription(`The HR team has decided to start a session. If you voted, you **must** join within 15 minutes or else you will be moderated. You can quick join using the button below.\n\n> - **Server Name:** ${serverInfo.Name}\n> - **Server Code:** ${serverInfo.JoinKey}\n> - **Server Owner:** ${ownerUser}`)
                            .setColor('#018f1b')
                            .setAuthor({ name: `@${user.username}`, iconURL: user.displayAvatarURL() })
                            .setImage(bannerFor('start'))
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('Quick Join')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://policeroleplay.community/join?code=SouthFLRP&placeId=2534724415')
                        )
                    ]
                });
                } catch (err) {
                    console.warn('sessions start: channel.send failed:', err?.message || err);
                    await interaction.followUp({ content: `${ephemeralEmoji('error_generic')} I couldn’t post the start message in the sessions channel. Please check channel permissions and try again.`, flags: MessageFlags.Ephemeral });
                    break;
                }

                await interaction.followUp({ content: `${ephemeralEmoji('success_start')} Successfully started the session.`, flags: MessageFlags.Ephemeral });
                // Update session status panel button to Online (green)
                try { await sessionStatusPanel.setStatus(client, 'online'); } catch (e) { console.warn('sessions start: status panel update failed:', e?.message || e); }

                // Optionally trigger an immediate status panel refresh once; ongoing updates handled by its 60s timer
                try { await sessionStatusPanel.refresh(client); } catch (e) { console.warn('sessions start: status panel immediate refresh failed:', e?.message || e); }
                break;
		}
	}
}