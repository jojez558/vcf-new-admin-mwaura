const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    // unique index created manually below to avoid silent crashes
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  consentGiven: {
    type: Boolean,
    required: true,
    default: true,
  },
});

// Create unique index explicitly so Mongoose syncs it properly
contactSchema.index({ phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model("Contact", contactSchema);
