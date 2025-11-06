const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const SuggestionsModel = require("../models/suggestionModel");
const { ephemeralEmoji } = require("../utils/emoji");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Suggests something for the server.")
    .addStringOption((option) =>
      option
        .setName("suggestion")
        .setDescription("What you are suggesting")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const suggestion = interaction.options.getString("suggestion");

    let suggestionNumber = 1;
    const lastSuggestion = await SuggestionsModel.findOne().sort({
      suggestionNumber: -1,
    });
    if (lastSuggestion && lastSuggestion.suggestionNumber) {
      suggestionNumber = lastSuggestion.suggestionNumber + 1;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Suggestion #${suggestionNumber}`)
      .setDescription(`**Suggestion:**\n${suggestion}`)
      .setColor(process.env.GLOBAL_EMBED_COLOR || "#fc2f56")
      .setAuthor({
        name: `${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }));

    const imageUrl = process.env.SUGGESTION_IMAGE_URL;
    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("suggestionupvote")
        .setEmoji("👍")
        .setLabel("0")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("suggestiondownvote")
        .setEmoji("👎")
        .setLabel("0")
        .setStyle(ButtonStyle.Secondary)
    );

    const channelId = process.env.SUGGESTION_CHANNEL_ID;
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.reply({
        content: `${ephemeralEmoji("error")} Suggestion channel not configured. Set \`SUGGESTION_CHANNEL_ID\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const message = await channel.send({
      embeds: [embed],
      components: [row],
    });

    const thread = await message.startThread({ name: `Suggestion Thread #${suggestionNumber}` });
    await thread.send(
      `${interaction.user.toString()}, you can add details to your **suggestion** here!`
    );

    const newSuggestion = new SuggestionsModel({
      messageId: message.id,
      suggestionNumber,
      upvotes: 0,
      downvotes: 0,
      upvoters: [],
      downvoters: [],
    });
    await newSuggestion.save();

    await interaction.reply({
      content: `${ephemeralEmoji("success")} Successfully created your suggestion! View it in ${channel.toString()}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
  customIDs: {
    upvote: "suggestionupvote",
    downvote: "suggestiondownvote",
  },
  async handleButton(interaction) {
    const isUpvote = interaction.customId === "suggestionupvote";
    const isDownvote = interaction.customId === "suggestiondownvote";
    if (!isUpvote && !isDownvote) return;

    const messageId = interaction.message.id;
    const userId = interaction.user.id;

    const suggestionDoc = await SuggestionsModel.findOne({ messageId });
    if (!suggestionDoc) {
      await interaction.reply({
        content: `${ephemeralEmoji("error")} Suggestion record not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let upvotes = suggestionDoc.upvotes || 0;
    let downvotes = suggestionDoc.downvotes || 0;
    const upvoters = new Set(suggestionDoc.upvoters || []);
    const downvoters = new Set(suggestionDoc.downvoters || []);

    let action = "";
    if (isUpvote) {
      if (upvoters.has(userId)) {
        upvoters.delete(userId);
        upvotes = Math.max(0, upvotes - 1);
        action = "removed your upvote";
      } else {
        upvoters.add(userId);
        upvotes += 1;
        action = "added your upvote";
        if (downvoters.has(userId)) {
          downvoters.delete(userId);
          downvotes = Math.max(0, downvotes - 1);
        }
      }
    }

    if (isDownvote) {
      if (downvoters.has(userId)) {
        downvoters.delete(userId);
        downvotes = Math.max(0, downvotes - 1);
        action = "removed your downvote";
      } else {
        downvoters.add(userId);
        downvotes += 1;
        action = "added your downvote";
        if (upvoters.has(userId)) {
          upvoters.delete(userId);
          upvotes = Math.max(0, upvotes - 1);
        }
      }
    }

    suggestionDoc.upvotes = upvotes;
    suggestionDoc.downvotes = downvotes;
    suggestionDoc.upvoters = Array.from(upvoters);
    suggestionDoc.downvoters = Array.from(downvoters);
    await suggestionDoc.save();

    // Rebuild components with updated counts
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("suggestionupvote")
        .setEmoji("👍")
        .setLabel(String(upvotes))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("suggestiondownvote")
        .setEmoji("👎")
        .setLabel(String(downvotes))
        .setStyle(ButtonStyle.Secondary)
    );

    // Update message and send ephemeral ack
    await interaction.deferUpdate();
    await interaction.message.edit({ components: [row] });
    await interaction.followUp({
      content: `${ephemeralEmoji("success")} Successfully ${action}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
