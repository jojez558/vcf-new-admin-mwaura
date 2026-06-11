let adminData = { name: "Administrator", phone: "+254 712 345 678" };

// Load admin info
async function loadAdminInfo() {
  try {
    const res = await fetch("/api/admin-info");
    const data = await res.json();
    adminData = data;
    document.getElementById("admin-name").textContent = data.name;
    document.getElementById("admin-phone").textContent = data.phone;
    document.getElementById("avatar").textContent = data.name
      .charAt(0)
      .toUpperCase();
  } catch {
    document.getElementById("admin-name").textContent = "Administrator";
  }
}

// Save VCF contact - shows 10 second loading then reveals form
function saveContact() {
  const btn = document.getElementById("save-btn");

  // Already saving or done
  if (btn.getAttribute("data-saving")) return;
  btn.setAttribute("data-saving", "1");

  // Disable button and show countdown
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    Saving… <span id="countdown">10</span>s
  `;

  let seconds = 10;
  const timer = setInterval(() => {
    seconds--;
    const cd = document.getElementById("countdown");
    if (cd) cd.textContent = seconds;

    if (seconds <= 0) {
      clearInterval(timer);

      // Trigger the actual download
      triggerVCFDownload();

      // Update button to success state
      btn.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
        Contact Saved!
      `;
      btn.style.background = "linear-gradient(135deg, #15803d, #16a34a)";
      btn.disabled = false;

      // Reveal the form
      revealForm();
    }
  }, 1000);
}

function triggerVCFDownload() {
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${adminData.name}`,
    `TEL:${adminData.phone}`,
    "END:VCARD",
  ].join("\n");

  const blob = new Blob([vcf], { type: "text/vcard" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${adminData.name.replace(/\s+/g, "_")}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy phone number - does NOT reveal the form
async function copyPhone() {
  const fb = document.getElementById("copy-feedback");
  const phone = adminData.phone;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(phone);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = phone;
      textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("execCommand failed");
    }
    showFeedback(fb, "✅ Phone number copied successfully!", "success");
  } catch {
    showFeedback(fb, "❌ Copy failed. Please copy manually: " + phone, "error");
  }
}

// Show the opt-in form only after VCF is saved
function revealForm() {
  const section = document.getElementById("form-section");
  if (section.getAttribute("data-shown")) return;
  section.setAttribute("data-shown", "1");
  section.style.display = "block";
  section.style.opacity = "0";
  section.style.transform = "translateY(20px)";
  section.style.transition = "opacity .4s ease, transform .4s ease";
  setTimeout(() => {
    section.style.opacity = "1";
    section.style.transform = "translateY(0)";
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

// Submit contact with counter display
async function submitContact() {
  const fullName = document.getElementById("fullName").value.trim();
  const phoneNumber = document.getElementById("phoneNumber").value.trim();
  const consent = document.getElementById("consent").checked;
  const fb = document.getElementById("form-feedback");

  if (!fullName) {
    showFeedback(fb, "⚠️ Please enter your full name.", "error");
    return;
  }
  if (!phoneNumber) {
    showFeedback(fb, "⚠️ Please enter your phone number.", "error");
    return;
  }
  if (!consent) {
    showFeedback(
      fb,
      "⚠️ You must agree to share your contact information.",
      "error",
    );
    return;
  }

  try {
    const res = await fetch("/api/submit-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phoneNumber, consent }),
    });
    const data = await res.json();

    if (data.success) {
      // Update the counter
      updateCounter(data.total, data.max);
      showFeedback(fb, "✅ Your contact was shared successfully!", "success");
      document.getElementById("fullName").value = "";
      document.getElementById("phoneNumber").value = "";
      document.getElementById("consent").checked = false;
    } else {
      showFeedback(fb, "❌ " + data.error, "error");
    }
  } catch {
    showFeedback(fb, "❌ Connection error. Please try again.", "error");
  }
}

// Load and display submission counter
async function loadCounter() {
  try {
    const res = await fetch("/api/submission-count");
    const data = await res.json();
    updateCounter(data.total, data.max);
  } catch {
    // silently fail
  }
}

function updateCounter(total, max) {
  const el = document.getElementById("submission-counter");
  if (!el) return;
  const pct = Math.round((total / max) * 100);
  el.querySelector(".count-text").textContent =
    `${total} out of ${max} slots filled`;
  el.querySelector(".count-bar-fill").style.width = `${pct}%`;
  el.querySelector(".count-pct").textContent = `${pct}%`;
}

function showFeedback(el, msg, type) {
  el.textContent = msg;
  el.className = "feedback " + type;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Init
loadAdminInfo();
loadCounter();
