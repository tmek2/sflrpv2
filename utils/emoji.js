const DEFAULTS = {
  info: 'ℹ️',
  error: '❌',
  permission: '⛔',
  config: '⚙️',
  db_down: '🛑',
  not_found: '🔍',
  claimed: '🤝',
  creating: '🛠️',
  created: '✅',
  limit_reached: '🚫',
  closing: '🧹',
  modal_fail: '🧩',
  modal_fail_retry: '🔁',
  success: '✅',
  success_add: '✅',
  success_remove: '🗑️',
  vote_added: '🗳️',
  vote_removed: '🗳️',
  success_full: '🏁',
  success_boost: '🚀',
  success_poll: '🗳️',
  success_start: '▶️',
  loading: '⏳'
};

const DEFAULTS_SERVERINFO = {
  id: '🆔',
  owner: '👑',
  members: '👥',
  created: '📅',
  boosts: '🚀',
  roles: '🔖'
};

const DEFAULTS_PING = {
  title: '🏓',
  ws: '📡',
  response: '⚡',
  status: '📊',
  excellent: '🟢',
  good: '🟡',
  fair: '🟠',
  poor: '🔴'
};

// ER:LC logging emojis (overridable via .env)
const DEFAULTS_ERLC = {
  players: '👥',
  list: '📋',
  join: '➕',
  leave: '➖',
  player: '🧑',
  killer: '🔪',
  killed: '☠️',
  kill: '⚔️',
  command: '⌨️',
  modcall: '🚨',
  moderator: '🛡️',
  time: '📅',
  type: '🏷️',
  ban: '🚫',
  queue: '⏳',
  count: '🔢'
};

function ephemeralEmoji(tag = 'info') {
  const upperTag = String(tag).toUpperCase();

  // Use a single per-tag variable (unicode or full mention like <:name:id> or <a:name:id>)
  const rawKey = `EPHEMERAL_EMOJI_${upperTag}`;
  const rawVal = process.env[rawKey];
  if (rawVal && typeof rawVal === 'string' && rawVal.trim().length) {
    return rawVal.trim();
  }

  // Final fallback to defaults
  return DEFAULTS[tag] || DEFAULTS.info;
}

function serverInfoEmoji(tag) {
  const upperTag = String(tag).toUpperCase();
  const rawKey = `SERVERINFO_EMOJI_${upperTag}`;
  const rawVal = process.env[rawKey];
  if (rawVal && typeof rawVal === 'string' && rawVal.trim().length) {
    return rawVal.trim();
  }
  return DEFAULTS_SERVERINFO[tag] || DEFAULTS.info;
}

function pingEmoji(tag) {
  const upperTag = String(tag).toUpperCase();
  const rawKey = `PING_EMOJI_${upperTag}`;
  const rawVal = process.env[rawKey];
  if (rawVal && typeof rawVal === 'string' && rawVal.trim().length) {
    return rawVal.trim();
  }
  return DEFAULTS_PING[tag] || DEFAULTS.info;
}

function pingStatusEmoji(level) {
  const upperTag = String(level).toUpperCase();
  const rawKey = `PING_STATUS_EMOJI_${upperTag}`;
  const rawVal = process.env[rawKey];
  if (rawVal && typeof rawVal === 'string' && rawVal.trim().length) {
    return rawVal.trim();
  }
  return DEFAULTS_PING[level] || DEFAULTS.info;
}

function erlcEmoji(tag) {
  const upperTag = String(tag).toUpperCase();
  const rawKey = `ERLC_EMOJI_${upperTag}`;
  const rawVal = process.env[rawKey];
  if (rawVal && typeof rawVal === 'string' && rawVal.trim().length) {
    return rawVal.trim();
  }
  return DEFAULTS_ERLC[tag] || DEFAULTS.info;
}

module.exports = { ephemeralEmoji, serverInfoEmoji, pingEmoji, pingStatusEmoji, erlcEmoji };