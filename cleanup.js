const mongoose = require('mongoose');
const DashboardHelpTicket = require('./models/dashboardHelpSchema');
const Suggestion = require('./models/suggestionModel');

function daysToMs(days) {
  const d = Number(days || 0);
  return Math.max(0, d) * 24 * 60 * 60 * 1000;
}

async function runCleanupOnce() {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return; // skip if not connected
    }
    const now = Date.now();
    const log = String(process.env.MONGO_CLEANUP_LOG || 'true').toLowerCase() === 'true';

    // Dashboard help tickets: prune closed older than retention
    const helpRetentionMs = daysToMs(process.env.RETENTION_DASHBOARD_HELP_DAYS || 30);
    if (helpRetentionMs > 0) {
      const cutoff = new Date(now - helpRetentionMs);
      const res = await DashboardHelpTicket.deleteMany({ status: 'closed', createdAt: { $lt: cutoff } });
      if (log) console.log(`[cleanup] DashboardHelpTicket: deleted ${res?.deletedCount || 0} closed records older than ${Math.round(helpRetentionMs/86400000)}d.`);
    }

    // Suggestions: prune older than retention (timestamps enabled)
    const suggRetentionMs = daysToMs(process.env.RETENTION_SUGGESTION_DAYS || 90);
    if (suggRetentionMs > 0) {
      const cutoff = new Date(now - suggRetentionMs);
      const res = await Suggestion.deleteMany({ createdAt: { $lt: cutoff } });
      if (log) console.log(`[cleanup] Suggestion: deleted ${res?.deletedCount || 0} records older than ${Math.round(suggRetentionMs/86400000)}d.`);
    }
  } catch (err) {
    console.warn('[cleanup] error:', err?.message || err);
  }
}

function startCleanupScheduler() {
  const enabled = String(process.env.MONGO_CLEANUP_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) return;
  const interval = Number(process.env.MONGO_CLEANUP_INTERVAL_MS || 86_400_000); // 24h
  // Fire once shortly after boot (5 min) to avoid startup spikes, then on interval
  setTimeout(runCleanupOnce, 5 * 60 * 1000);
  setInterval(runCleanupOnce, interval);
  console.log(`[cleanup] MongoDB cleanup scheduler started (interval ${Math.round(interval/3600000)}h).`);
}

module.exports = { startCleanupScheduler, runCleanupOnce };