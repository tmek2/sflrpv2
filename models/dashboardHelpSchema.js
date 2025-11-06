const mongoose = require('mongoose');

const dashboardHelpSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  channelId: { type: String, required: true },
  reason: { type: String, required: true },
  type: { type: String, default: 'general' },
  status: { type: String, default: 'open' },
  createdAt: { type: Date, default: Date.now },
  claimedBy: { type: String, default: null },
  closedBy: { type: String, default: null },
  ticketId: { type: String, required: true, unique: true },
  closeReason: { type: String, default: null }
});

module.exports = mongoose.model('DashboardHelpTicket', dashboardHelpSchema);