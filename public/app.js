// OneCard Uno Chatbot — Frontend App

const API_BASE = "";  // Same origin as server (set PORT env var when running)

// Session state
let sessionState = {
  currentFlow: null,
  collectedSlots: {},
  nextSlot: null,
  frustrationScore: 0,
};

let turnCount = 0;
let waitingForOtp = false;
let pendingFlowName = null;
let inspectorOpen = false;
let isTyping = false;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  setupInput();
  await loadOpening();
});

async function loadOpening() {
  try {
    const res = await fetch(`${API_BASE}/api/opening`);
    const data = await res.json();

    // Populate stats bar
    document.getElementById("statOutstanding").textContent =
      "₹" + data.user.outstanding.toLocaleString("en-IN");
    document.getElementById("statDue").textContent = data.user.dueDate;
    document.getElementById("statPoints").textContent = data.user.rewardPoints.toLocaleString("en-IN");

    // Show opening message
    appendBotMessage({
      response: data.message,
      route: "A",
      tier: "OPENING",
      intent: "greeting",
      confidence: 100,
      language: "en",
    });
  } catch (e) {
    appendBotMessage({
      response: "Hi! I'm Uno, your OneCard AI assistant. How can I help you today?",
      route: "A",
      tier: "OPENING",
    });
  }
}

// ─── Input setup ──────────────────────────────────────────────────────────────
function setupInput() {
  const input = document.getElementById("msgInput");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 80) + "px";
  });

  // Ctrl+Shift+D — toggle inspector panel
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      e.preventDefault();
      toggleInspector();
    }
  });
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage(overrideText) {
  const input = document.getElementById("msgInput");
  const text = overrideText !== undefined ? overrideText : input.value.trim();
  if (!text || isTyping || waitingForOtp) return;

  if (!overrideText) {
    input.value = "";
    input.style.height = "auto";
  }

  appendUserMessage(text);
  showTyping();
  disableInput(true);

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionState }),
    });
    const data = await res.json();

    hideTyping();

    // Update session state
    if (data.sessionState) {
      sessionState = data.sessionState;
    }

    // Update frustration bar
    updateFrustrationBar(sessionState.frustrationScore || 0);

    // Render response
    appendBotMessage(data);
    addInspectorEntry(data, text);

    // Prototype mode: OTP is auto-verified — no card, no blocking
    // In production this would show the OTP card and wait
    if (data.requires_otp && !waitingForOtp) {
      waitingForOtp = true;
      pendingFlowName = data.flow_name;
      setTimeout(() => autoVerifyOtp(), 400);
    }

    turnCount++;
  } catch (e) {
    hideTyping();
    appendBotMessage({
      response: "I'm having trouble connecting right now. Let me get a team member to help you immediately.",
      route: "D",
      tier: "FALLBACK",
      deep_link: "Connect to Agent",
    });
  }

  disableInput(false);
  document.getElementById("msgInput").focus();
}

// ─── Append messages ──────────────────────────────────────────────────────────
function appendUserMessage(text) {
  const msgs = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `
    <div class="msg-avatar">R</div>
    <div class="msg-content">
      <div class="msg-bubble">${escHtml(text)}</div>
    </div>
  `;
  msgs.appendChild(div);
  scrollToBottom();
}

function appendBotMessage(data) {
  const msgs = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg bot";

  const route = data.route || "A";
  const tier = data.tier || "T3_LLM";
  const tierLabel = getTierLabel(tier);
  const citation = data.compliance_citation || data.compliance_citation;

  let extras = "";

  // Route D — Agent handoff card
  if (route === "D") {
    extras += `
      <div class="agent-card">
        <div class="agent-card-title">Connecting to Support Team</div>
        <div class="agent-card-body">
          Your conversation history and account context will be shared with the agent so you don't need to repeat anything.
        </div>
        <div class="agent-card-action">
          <button class="agent-btn primary" onclick="alert('Live chat would open here in production.')">Live Chat</button>
          <button class="agent-btn secondary" onclick="alert('Callback scheduled. We\\'ll call within 2 hours.')">Schedule Call</button>
        </div>
      </div>`;
  }

  // Clarify options (Route C)
  if (data.clarify_options && data.clarify_options.length) {
    extras += `<div class="clarify-options">`;
    data.clarify_options.forEach((opt) => {
      extras += `<button class="clarify-btn" onclick="sendMessage(${JSON.stringify(opt)})">${escHtml(opt)}</button>`;
    });
    extras += `</div>`;
  }

  // Slot options (if next slot has predefined options)
  if (data.next_slot && data.flow_name) {
    const slotOptions = getSlotOptions(data.flow_name, data.next_slot);
    if (slotOptions) {
      extras += `<div class="slot-options">`;
      slotOptions.forEach((opt) => {
        extras += `<button class="slot-btn" onclick="sendMessage(${JSON.stringify(opt)})">${escHtml(opt)}</button>`;
      });
      extras += `</div>`;
    }
  }

  // Deep link button
  if (data.deep_link) {
    extras += `
      <button class="deep-link-btn" onclick="handleDeepLink(${JSON.stringify(data.deep_link)})">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
        ${escHtml(data.deep_link)}
      </button>`;
  }

  div.innerHTML = `
    <div class="msg-avatar">U</div>
    <div class="msg-content">
      <div class="msg-bubble">${renderMarkdown(data.response || "")}</div>
      ${extras}
      ${tier !== "OPENING" ? `
        <div class="tier-info">
          <span class="route-badge route-${getRouteBadgeClass(route, tier)}">${getRouteBadgeText(route, tier)}</span>
          ${tierLabel}
          ${citation ? `· <em>${escHtml(citation)}</em>` : ""}
        </div>` : ""}
    </div>
  `;
  msgs.appendChild(div);
  scrollToBottom();
}

// ─── Slot options lookup ──────────────────────────────────────────────────────
function getSlotOptions(flowName, slotName) {
  const FLOW_SLOT_OPTIONS = {
    card_block:        { block_reason: ["Lost", "Stolen", "Suspicious activity", "Temporary block"] },
    card_replacement:  { reason: ["Damaged", "Stolen", "Lost", "Upgrade"] },
    emi_conversion:    { tenure: ["3 months", "6 months", "9 months", "12 months"] },
    dispute_filing:    { reason: ["Not received", "Wrong amount", "Duplicate charge", "Fraud/Unauthorized"] },
    autopay_setup:     { autopay_type: ["Full outstanding", "Minimum due", "Fixed amount"] },
    emi_foreclosure:   { emi_select: ["Amazon ₹3,750/month (8 remaining)"] },
    privacy_settings:  { preference_type: ["Marketing notifications", "Transaction alerts", "Data sharing preferences", "Email preferences"] },
    support_escalation:{ issue_category: ["Card issue", "Payment dispute", "EMI problem", "Account query", "Fraud concern", "Other"] },
  };
  return FLOW_SLOT_OPTIONS[flowName]?.[slotName] || null;
}

// ─── OTP: Prototype auto-verify ───────────────────────────────────────────────
// In production: show OTP card, wait for user input, then verify with backend.
// In prototype: auto-verify immediately and continue the flow.
function autoVerifyOtp() {
  waitingForOtp = false;

  // Show a subtle system note (not a full message bubble) indicating auto-verify
  const msgs = document.getElementById("messages");
  const note = document.createElement("div");
  note.className = "otp-auto-note";
  note.innerHTML = `<span class="otp-auto-icon">🔐</span> OTP auto-verified <em>(prototype mode)</em>`;
  msgs.appendChild(note);
  scrollToBottom();

  // Continue the flow — server will complete it since slots are filled or 0-slot
  setTimeout(() => {
    sendMessage("__otp_verified__");
  }, 300);
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function showTyping() {
  isTyping = true;
  const msgs = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "msg bot";
  div.id = "typingIndicator";
  div.innerHTML = `
    <div class="msg-avatar">U</div>
    <div class="msg-content">
      <div class="typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  msgs.appendChild(div);
  scrollToBottom();
}

function hideTyping() {
  isTyping = false;
  document.getElementById("typingIndicator")?.remove();
}

// ─── Frustration bar ──────────────────────────────────────────────────────────
function updateFrustrationBar(score) {
  const pct = Math.round(score * 100);
  document.getElementById("frustrationFill").style.width = pct + "%";
  document.getElementById("frustrationPct").textContent = pct + "%";
}

// ─── Inspector ────────────────────────────────────────────────────────────────
function toggleInspector() {
  inspectorOpen = !inspectorOpen;
  document.getElementById("inspector").classList.toggle("open", inspectorOpen);
}

function addInspectorEntry(data, userMsg) {
  const container = document.getElementById("inspectorEntries");
  const entry = document.createElement("div");
  entry.className = "inspector-entry";

  const fields = [
    ["Turn", turnCount + 1],
    ["Route", data.route],
    ["Tier", data.tier],
    ["Intent", data.intent],
    ["Confidence", data.confidence ? data.confidence + "%" : "—"],
    ["Language", data.language],
    ["Flow", data.flow_name || "none"],
    ["Slot filled", data.slot_filled || "—"],
    ["Next slot", data.next_slot || "—"],
    ["Frustration", Math.round((data.sessionState?.frustrationScore || 0) * 100) + "%"],
    ["Citation", data.compliance_citation || "—"],
  ];

  entry.innerHTML = `
    <div class="inspector-turn">Turn ${turnCount + 1} · "${userMsg.slice(0, 20)}${userMsg.length > 20 ? "…" : ""}"</div>
    ${fields.map(([k, v]) =>
      `<div><span class="inspector-key">${k}: </span><span class="inspector-val ${k === "Route" ? "highlight" : ""}">${v}</span></div>`
    ).join("")}
  `;
  container.insertBefore(entry, container.firstChild);
}

// ─── Deep link handler ────────────────────────────────────────────────────────
function handleDeepLink(label) {
  alert(`Deep link: "${label}"\nIn production, this would open the relevant screen in the OneCard app.`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scrollToBottom() {
  const msgs = document.getElementById("messages");
  setTimeout(() => {
    msgs.scrollTop = msgs.scrollHeight;
  }, 50);
}

function disableInput(state) {
  document.getElementById("msgInput").disabled = state;
  document.getElementById("sendBtn").disabled = state;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Markdown renderer: bold, italic, code, bullet lists, line breaks
function renderMarkdown(text) {
  // Split into lines first so we can handle lists properly
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Bullet: lines starting with •, -, or * (followed by space)
    const bulletMatch = raw.match(/^[•\-\*]\s+(.+)/);
    if (bulletMatch) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + inlineMarkdown(bulletMatch[1]) + "</li>";
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      const trimmed = raw.trim();
      if (trimmed === "") {
        // blank line — only add <br> if we have content already
        if (html.length > 0) html += "<br>";
      } else {
        html += (html.length > 0 && !html.endsWith("<br>") && !html.endsWith("</ul>") && !html.endsWith("</li>"))
          ? "<br>" + inlineMarkdown(trimmed)
          : inlineMarkdown(trimmed);
      }
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function inlineMarkdown(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function getTierLabel(tier) {
  const labels = {
    T0_CACHE: "Cache hit",
    T1_STATIC: "MITC lookup",
    T2_ROUTER: "Semantic router",
    T3_LLM: "AI generated",
    FALLBACK: "Fallback",
    OTP: "OTP flow",
    OPENING: "",
    FRUSTRATION: "Frustration override",
    SECURITY: "Security filter",
  };
  return labels[tier] || tier;
}

function getRouteBadgeClass(route, tier) {
  if (tier === "T1_STATIC") return "T1";
  if (tier === "SECURITY") return "SECURITY";
  if (tier === "FRUSTRATION") return "FRUSTRATION";
  return route;
}

function getRouteBadgeText(route, tier) {
  if (tier === "T1_STATIC") return "T1 · MITC";
  if (tier === "T0_CACHE") return "T0 · Cache";
  if (tier === "SECURITY") return "Security";
  if (tier === "FRUSTRATION") return "Frustration";
  if (tier === "OTP") return "OTP";
  if (tier === "FALLBACK") return "Fallback";
  const labels = { A: "Route A · Direct", B: "Route B · Confirm", C: "Route C · Clarify", D: "Route D · Escalate", E: "Route E · OOS" };
  return labels[route] || `Route ${route}`;
}
