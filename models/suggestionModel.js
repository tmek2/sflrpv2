const { Schema, model } = require('mongoose');

const suggestionSchema = new Schema(
  {
    messageId: { type: String, required: true },
    suggestionNumber: { type: Number, required: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    upvoters: { type: [String], default: [] },
    downvoters: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = model('Suggestion', suggestionSchema);