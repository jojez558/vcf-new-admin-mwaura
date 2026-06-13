const express = require("express");
const router = express.Router();
const Contact = require("../models/Contact");
const Admin = require("../models/Admin");
const authMiddleware = require("../middleware/auth");
const { Parser } = require("json2csv");
const path = require("path");

// Seed default admin if none exists
async function ensureAdmin() {
  const count = await Admin.countDocuments();
  if (count === 0) {
    const admin = new Admin({
      username: "admin",
      password: "Admin@1234",
      name: "Alex Johnson",
      phone: "+254 712 345 678",
    });
    await admin.save();
    console.log("Default admin created: username=admin, password=Admin@1234");
  }
}
ensureAdmin();

// Apply auth middleware to all admin routes except login
router.use(authMiddleware);

// Login page
router.get("/login-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "login.html"));
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    req.session.adminId = admin._id;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Dashboard page
router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "dashboard.html"));
});

// Get contacts (with search) — maximum 1000 contacts visible
router.get("/contacts", async (req, res) => {
  try {
    const MAX_CONTACTS = 1000;
    const { search, page = 1, limit = 20 } = req.query;

    const query = search
      ? {
          $or: [
            { fullName: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Cap total at 1000
    const rawTotal = await Contact.countDocuments(query);
    const total = Math.min(rawTotal, MAX_CONTACTS);

    const contacts = await Contact.find(query)
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Math.min(Number(limit), MAX_CONTACTS));

    res.json({ contacts, total, pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// Delete contact
router.delete("/contacts/:id", async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// Bulk import contacts (admin only - already protected by authMiddleware)
router.post("/bulk-import", async (req, res) => {
  try {
    const MAX_CONTACTS = 1000;
    const { entries } = req.body; // [{ fullName, phoneNumber }, ...]

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "No entries provided." });
    }

    let currentCount = await Contact.countDocuments();
    let added = 0,
      duplicates = 0,
      invalid = 0,
      capped = 0;

    for (const entry of entries) {
      if (currentCount >= MAX_CONTACTS) {
        capped++;
        continue;
      }

      const phone = (entry.phoneNumber || "").trim();
      const name = (entry.fullName || "").trim() || "Unknown";

      if (!phone || phone.length < 7) {
        invalid++;
        continue;
      }

      const exists = await Contact.findOne({ phoneNumber: phone });
      if (exists) {
        duplicates++;
        continue;
      }

      try {
        await Contact.create({
          fullName: name,
          phoneNumber: phone,
          consentGiven: true,
        });
        added++;
        currentCount++;
      } catch (e) {
        if (e.code === 11000) duplicates++;
        else invalid++;
      }
    }

    res.json({
      success: true,
      added,
      duplicates,
      invalid,
      capped,
      total: Math.min(currentCount, MAX_CONTACTS),
      max: MAX_CONTACTS,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Export as VCF — capped at 1000
router.get("/export/vcf", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ submittedAt: -1 }).limit(1000);
    let vcf = "";
    contacts.forEach((c) => {
      vcf += `BEGIN:VCARD\nVERSION:3.0\nFN:${c.fullName}\nTEL:${c.phoneNumber}\nEND:VCARD\n`;
    });
    res.setHeader("Content-Type", "text/vcard");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.vcf");
    res.send(vcf);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

// Export as CSV — capped at 1000
router.get("/export/csv", async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ submittedAt: -1 }).limit(1000);
    const fields = ["fullName", "phoneNumber", "submittedAt"];
    const parser = new Parser({ fields });
    const csv = parser.parse(
      contacts.map((c) => ({
        fullName: c.fullName,
        phoneNumber: c.phoneNumber,
        submittedAt: new Date(c.submittedAt).toLocaleString(),
      })),
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
