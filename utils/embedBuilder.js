const { EmbedBuilder } = require('discord.js');

const GLOBAL_EMBED_COLOR = process.env.GLOBAL_EMBED_COLOR || '#fc2f56';

function createEmbed(options = {}) {
  const {
    title,
    description,
    color,
    fields,
    footer,
    thumbnail,
    image,
    author,
    timestamp
  } = options;

  const embed = new EmbedBuilder();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  const effectiveColor = GLOBAL_EMBED_COLOR || color;
  if (typeof effectiveColor !== 'undefined' && effectiveColor !== null) embed.setColor(effectiveColor);
  if (Array.isArray(fields) && fields.length) embed.addFields(...fields);
  if (footer && typeof footer === 'object') embed.setFooter(footer);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (author && typeof author === 'object') embed.setAuthor(author);
  if (timestamp) embed.setTimestamp(timestamp === true ? Date.now() : timestamp);
  return embed;
}

module.exports = { createEmbed };