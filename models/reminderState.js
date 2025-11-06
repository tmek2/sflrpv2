const mongoose = require('mongoose');

const reminderStateSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true },
  channelId: { type: String, required: true },
  messageId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ReminderState', reminderStateSchema);