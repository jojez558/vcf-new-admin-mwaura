const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");
const Admin = require("../models/Admin");

const MAX_CONTACTS = 1000;

// Get admin info for homepage
router.get("/admin-info", async (req, res) => {
  try {
    const admin = await Admin.findOne({}, "name phone");
    if (!admin) {
      return res.json({ name: "Administrator", phone: "+254 712 345 678" });
    }
    res.json({ name: admin.name, phone: admin.phone });
  } catch (err) {
    console.error("admin-info error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get submission count for the counter
router.get("/submission-count", async (req, res) => {
  try {
    const total = await Contact.countDocuments();
    res.json({ total: Math.min(total, MAX_CONTACTS), max: MAX_CONTACTS });
  } catch (err) {
    console.error("submission-count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit contact
router.post("/submit-contact", async (req, res) => {
  try {
    const { fullName, phoneNumber, consent } = req.body;

    // Validate inputs
    if (!consent) {
      return res.status(400).json({ error: "Consent is required." });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Full name is required." });
    }
    if (!phoneNumber || !phoneNumber.trim()) {
      return res.status(400).json({ error: "Phone number is required." });
    }

    // Check max cap
    const currentCount = await Contact.countDocuments();
    if (currentCount >= MAX_CONTACTS) {
      return res
        .status(403)
        .json({
          error: "Maximum submissions reached. No more contacts can be added.",
        });
    }

    // Check duplicate
    const existing = await Contact.findOne({ phoneNumber: phoneNumber.trim() });
    if (existing) {
      return res
        .status(409)
        .json({ error: "This phone number has already been submitted." });
    }

    // Save
    const contact = new Contact({
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      consentGiven: true,
    });
    await contact.save();

    const newTotal = await Contact.countDocuments();
    res.json({
      success: true,
      message: "Contact saved successfully!",
      total: Math.min(newTotal, MAX_CONTACTS),
      max: MAX_CONTACTS,
    });
  } catch (err) {
    console.error("submit-contact error:", err.message, err.code);

    // Handle MongoDB duplicate key error (code 11000)
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "This phone number has already been submitted." });
    }

    res.status(500).json({ error: "Server error: " + err.message });
  }
});

module.exports = router;
