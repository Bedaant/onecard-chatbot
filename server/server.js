const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { TIER1_KEYWORDS, TIER1_RESPONSES } = require("../prototype/data/mitc");
const { MOCK_USER, INTENT_CONTEXT_MAP } = require("../prototype/data/mockUser");
const { FLOWS, requiresOtp } = require("../prototype/data/flows");
const { FAQS } = require("../prototype/data/faqs");

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET", "POST"] })); // Restrict in production
app.use(express.json({ limit: "10kb" })); // Prevent large payload attacks
app.use(express.static(path.join(__dirname, "../public")));

// Basic security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Simple in-memory rate limiter: max 30 requests/min per IP
const rateLimitMap = new Map();
app.use("/api/chat", (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = process.env.NODE_ENV === "test" ? 500 : 30;
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    rateLimitMap.set(ip, { count: 1, start: now });
  } else if (entry.count >= max) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  } else {
    entry.count++;
    rateLimitMap.set(ip, entry);
  }
  next();
});

// ─── Security: Injection + PII ────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  "ignore previous instructions", "ignore all instructions",
  "forget your rules", "you are now", "pretend you are",
  "jailbreak", "<|im_start|>", "system override", "act as", "disregard",
  "new instructions", "override", "sudo",
];

const PII_PATTERNS = [
  /\b\d{16}\b/g,
  /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
  /\b\d{12}\b/g,
  /[A-Z]{5}\d{4}[A-Z]{1}/g,
  /\bCVV\s*:?\s*\d{3,4}\b/gi,
  /\bcvv\s*:?\s*\d{3,4}\b/gi,
];

function scanForInjection(text) {
  const lower = text.toLowerCase();
  return INJECTION_PATTERNS.some((p) => lower.includes(p));
}

function redactPII(text) {
  let clean = text;
  PII_PATTERNS.forEach((pattern) => {
    clean = clean.replace(pattern, "[REDACTED]");
  });
  return clean;
}

// ─── Frustration detection ────────────────────────────────────────────────────
const INSTANT_ESCALATION_KEYWORDS = [
  "talk to agent", "talk to human", "connect to agent", "human agent",
  "manager", "insaan se baat", "real person", "supervisor",
];

const FRUSTRATION_KEYWORDS = [
  "useless", "pathetic", "worst", "horrible", "bakwas", "bekar",
  "frustrated", "angry", "furious", "not working", "kuch nahi kar raha",
  "kaam nahi kar", "ye bot", "yaar ye", "bhai ye", "kaam ka nahi",
  "banda nahi hai", "koi sun nahi", "bura system", "terrible",
];

function detectFrustration(text) {
  const lower = text.toLowerCase();
  const isInstant = INSTANT_ESCALATION_KEYWORDS.some((k) => lower.includes(k));
  const isFrustrated = FRUSTRATION_KEYWORDS.some((k) => lower.includes(k));
  return { isInstant, isFrustrated };
}

// ─── Tier 1: Static keyword match ────────────────────────────────────────────
// Compound/explanatory patterns that should NOT match T1 even if keyword present.
// These indicate the user wants context, not just a rate/fee — let FAQ/LLM handle.
const T1_COMPOUND_PATTERNS = [
  /\b(kaise\s*bachu|kaise\s*avoid|how\s*to\s*avoid|how\s*do\s*i\s*avoid|kam\s*kaise|reduce\s*kaise)\b/i,
  /\b(kyun|kyon|why|explain|samjhao|batao|what\s*is\s*the\s*difference|matlab\s*kya)\b/i,
  /\b(when\s*does|kab\s*lagta|kab\s*charge|when\s*is\s*it\s*charged)\b/i,
];

function tier1Match(text) {
  const lower = text.toLowerCase();
  // Don't hijack compound questions — they need FAQ/LLM reasoning
  if (T1_COMPOUND_PATTERNS.some((p) => p.test(lower))) {
    return { matched: false };
  }
  for (const [key, keywords] of Object.entries(TIER1_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { matched: true, key, response: TIER1_RESPONSES[key] };
    }
  }
  return { matched: false };
}

// ─── FAQ matching ─────────────────────────────────────────────────────────────
function scoreFAQs(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length >= 2);
  const scored = FAQS.map((faq) => {
    const tagScore = faq.tags.filter((t) => lower.includes(t)).length * 3;
    const wordScore = words.filter((w) => faq.question.toLowerCase().includes(w)).length;
    const answerScore = words.filter((w) => faq.answer.toLowerCase().includes(w)).length * 0.5;
    const catBonus = lower.includes(faq.category.toLowerCase()) ? 2 : 0;
    return { faq, score: tagScore + wordScore + answerScore + catBonus };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

function findRelevantFAQs(text) {
  return scoreFAQs(text).slice(0, 3).map((s) => s.faq);
}

// Question-word detector
const QUESTION_WORDS_RE = /\b(kya|what|how|kaise|kyun|kyon|why|kaun|which|kab|when|explain|samjhao|batao|matlab|mean|hota|difference|antar)\b|\?/i;

// Action-verb detector — user wants to DO something
const ACTION_VERBS_RE = /\b(karna\s*hai|karo|kar\s*do|chahiye|start\s*karo|submit|file|convert|block\s*kardo|close\s*kardo|change\s*karo|update\s*karo|request|initiate)\b/i;

// ─── Intent type resolver ─────────────────────────────────────────────────────
// Single source of truth for FAQ vs Flow decision in the demo router and
// as a fallback override when Gemini's intent_type field is missing/null.
//
// Returns: "informational" | "transactional" | "ambiguous"
//
// Logic:
//   1. Pure question → informational
//   2. Pure action   → transactional
//   3. Both present  → tiebreak by main-verb heuristic:
//      "pata karna", "jaanna", "samajhna", "dekhna" = find-out verbs → informational
//      Everything else with action verb → transactional
//   4. Neither       → ambiguous (short single-topic word)
function resolveIntentType(text) {
  const lower = text.toLowerCase();
  const hasQ  = QUESTION_WORDS_RE.test(lower);
  const hasA  = ACTION_VERBS_RE.test(lower);

  if (hasQ && !hasA) return "informational";
  if (hasA && !hasQ) return "transactional";

  if (hasQ && hasA) {
    // Tiebreak: "find-out" verbs signal informational intent even with karna/chahiye
    const findOutVerbs = /\b(pata\s*karna|jaanna|samajhna|samajh\s*na|dekhna|check\s*karna|confirm\s*karna|batao\s*kya|bata\s*do\s*kya)\b/i;
    if (findOutVerbs.test(lower)) return "informational";
    // Both present but no find-out verb → user is doing something → transactional
    return "transactional";
  }

  // Neither — single word or very short → ambiguous
  return "ambiguous";
}

// ─── Slot input validation ───────────────────────────────────────────────────
function validateSlotInput(flowName, slotName, value) {
  const trimmed = String(value).trim();

  // account_closure.confirm MUST match exactly
  if (flowName === "account_closure" && slotName === "confirm") {
    if (trimmed.toLowerCase() !== "close my account") {
      return {
        ok: false,
        message: `To proceed with closure, type exactly **CLOSE MY ACCOUNT** (case-insensitive). Or type "cancel" to abort.`,
      };
    }
  }

  // address_change.new_address needs a PIN code (6 digits)
  if (flowName === "address_change" && slotName === "new_address") {
    if (trimmed.length < 20) {
      return { ok: false, message: "Please provide a complete address including house/flat, street, city, state, and 6-digit PIN code." };
    }
    if (!/\b\d{6}\b/.test(trimmed)) {
      return { ok: false, message: "Your address must include a 6-digit PIN code. Please provide the full address again." };
    }
  }

  // emi_conversion.transaction needs an amount
  if (flowName === "emi_conversion" && slotName === "transaction") {
    if (!/\d/.test(trimmed)) {
      return { ok: false, message: "Please include the transaction amount (e.g., 'Amazon ₹15,000' or 'Flipkart 12000')." };
    }
  }

  // autopay_setup — accept only the 3 predefined options
  if (flowName === "autopay_setup" && slotName === "autopay_type") {
    const lower = trimmed.toLowerCase();
    if (!/(full|minimum|fixed)/.test(lower)) {
      return { ok: false, message: "Please choose: **Full outstanding**, **Minimum due**, or **Fixed amount**." };
    }
  }

  return { ok: true };
}

// ─── Selective user context ───────────────────────────────────────────────────
function getSelectiveContext(intent) {
  const fields = INTENT_CONTEXT_MAP[intent] || INTENT_CONTEXT_MAP.general;
  const context = {};
  fields.forEach((f) => {
    if (MOCK_USER[f] !== undefined) context[f] = MOCK_USER[f];
  });
  return context;
}

// ─── Build Gemini system prompt ───────────────────────────────────────────────
function buildSystemPrompt(userContext, relevantFAQs, sessionState) {
  const faqText = relevantFAQs.length
    ? relevantFAQs.map((f) => `[${f.id}] Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "No specific FAQs matched this query.";

  const flowState = sessionState.currentFlow
    ? `ACTIVE FLOW: "${sessionState.currentFlow}" | Next slot needed: "${sessionState.nextSlot || "none"}" | Collected: ${JSON.stringify(sessionState.collectedSlots || {})}`
    : "No active flow.";

  return `You are Uno, OneCard's AI assistant (FPL Technologies / BOBCARD). You are an AI — say this clearly if asked.

LANGUAGE: Reply in the SAME language the user writes in. Hinglish → Hinglish, Hindi → Hindi, English → English. Financial terms always in English.

DECISION ORDER (strict):
1. ACTIVE FLOW? → Fill next slot. Never abandon mid-flow silently.
2. CANCEL SIGNAL? → "cancel/nevermind/nahi chahiye/rukk/mat karo/rehne do" → set flow_cancel:true
3. FLOW INTERRUPTION? → Off-topic question mid-flow → answer in ONE sentence, then redirect "Back to [flow name]—[next question]". CRITICAL: keep flow_name and next_slot unchanged — never set them to null during an interruption.
4. OUT OF SCOPE? → Non-card topics (weather, cricket, politics) → Route E
5. FRUSTRATION/ANGER? → Route D
6. STATIC FEE/RATE? → Use MITC table below. NEVER invent financial figures.
7. CLASSIFY → informational (answer from FAQ) | transactional (start flow) | ambiguous (Route C)

ROUTES:
A = Direct answer or start flow (confidence ≥ 72%)
B = Confirm before acting ("It sounds like X — is that right?")
C = Clarify with exactly 2 options (ambiguous, win margin < 8%)
D = Warm handoff to agent (frustration, unresolvable, explicit escalation request)
E = Out of scope

BRAND VOICE:
- Warm, direct, never robotic. Never say "Great question!" or "I understand your concern".
- "aap" in Hinglish/Hindi. Max 3 sentences. Max 1 emoji (✓ for completions only).
- Acknowledge frustration ONCE only, then move immediately to solution.

MITC TABLE (use exact values — never invent):
- Interest: 3.75%/month · 45%/year
- Interest-free: up to 48 days
- Late payment: after 3 days past due date
- Over-limit: 2.5% of over-limit amount (min ₹500)
- Cash advance: 2.5% of amount (min ₹300)
- EMI processing fee: 1% of amount (min ₹99)
- EMI foreclosure: 3% of outstanding principal (min ₹99)
- Forex markup: 1% of transaction amount
- Reward point: 1 point = ₹0.25
- Dispute window: 30 days from statement date
- Dispute SLA: 30 days (RBI mandate)
- Closure: 7 working days
- RBI Ombudsman: 14448

FAQ CONTEXT (cite FAQ-ID in answers):
${faqText}

USER ACCOUNT:
${JSON.stringify(userContext, null, 2)}

SESSION: ${flowState}
Frustration score: ${(sessionState.frustrationScore || 0).toFixed(2)}

FAQ vs FLOW — intent_type field (REQUIRED, used by server):
Set intent_type based on the FULL semantic meaning of the sentence, not just individual words:

"informational" → user wants to LEARN or UNDERSTAND something
  Examples: "EMI kya hota hai", "interest rate kya hai", "block karne se kya hota hai",
            "mujhe pata karna hai ki EMI kya hai", "repayment kaise karte hain",
            "dispute kya hota hai", "credit limit kya hai"
  Signal: kya/kaise/kyun/what/how/explain/samjhao/batao/hota/matlab at SENTENCE level
  → set flow_name: null, answer from FAQ/MITC

"transactional" → user wants to DO or PERFORM an action RIGHT NOW
  Examples: "card block karo", "EMI convert karna hai", "dispute file karna hai",
            "mera card kho gaya", "limit increase chahiye", "account band karna hai"
  Signal: karo/kar do/karna hai/chahiye/file/submit/block/lost/stolen at SENTENCE level
  → set appropriate flow_name

"ambiguous" → sentence genuinely works both ways, cannot determine
  Examples: "EMI" alone, "block" alone, "dispute"
  → set route: C, clarify_options with 2 options, flow_name: null

TIEBREAK: If both question word AND action verb present in same sentence:
  - Read the VERB of the main clause. Is the user doing something or asking about something?
  - "mujhe pata karna hai ki EMI kya hai" → main verb = "pata karna" (find out) → INFORMATIONAL
  - "mujhe EMI convert karna hai" → main verb = "convert karna" (do it) → TRANSACTIONAL
  - When genuinely unsure after this → "ambiguous"

AVAILABLE FLOWS (use exact key for flow_name — only for ACTION requests):
Core flows:
- card_block → slots:[block_reason] options:Lost/Stolen/Suspicious activity/Temporary block
- card_unblock → slots:[] → set flow_complete:true immediately
- card_replacement → slots:[reason] options:Damaged/Stolen/Lost/Upgrade
- account_closure → slots:[confirm] — show prerequisites first, then ask user to type "CLOSE MY ACCOUNT"
- emi_conversion → slots:[transaction,tenure] tenure options:3/6/9/12 months
- emi_foreclosure → slots:[emi_select] — user wants to pay off an EMI early
- limit_increase → slots:[amount] — request credit limit increase
- fraud_report → slots:[txn_details] — report a fraudulent transaction
- dispute_filing → slots:[transaction,reason] reason options:Not received/Wrong amount/Duplicate charge/Fraud/Unauthorized

Utility flows:
- bill_payment → slots:[] → set flow_complete:true immediately, show outstanding amount
- reward_redemption → slots:[] → set flow_complete:true immediately, show points
- statement_download → slots:[] → set flow_complete:true immediately
- autopay_setup → slots:[autopay_type] options:Full outstanding/Minimum due/Fixed amount
- address_change → slots:[new_address]
- pin_change → slots:[] → set flow_complete:true immediately

Additional flows:
- privacy_settings → slots:[preference_type] options:Marketing notifications/Transaction alerts/Data sharing preferences/Email preferences
- support_escalation → slots:[issue_category] options:Card issue/Payment dispute/EMI problem/Account query/Fraud concern/Other

MULTI-INTENT: If user message contains "and/aur/bhi/also/साथ" with two distinct intents:
- Identify both intents
- Resolve the transactional one first (block, dispute, fraud, etc.)
- Include the informational answer in the SAME response
- Set flow_name to the transactional intent

SLOT RULES:
- Stay in active flow until complete or cancelled
- 0-slot flows: ALWAYS set flow_complete:true in the SAME response that triggers them
- Ask ONE slot at a time using slotOptions as buttons when available
- Set flow_name throughout flow (never null until flow_complete or flow_cancel)

RESPOND WITH ONLY VALID JSON — no markdown fences, no extra text:
{
  "route": "A|B|C|D|E",
  "intent": "brief description",
  "intent_type": "informational|transactional|ambiguous",
  "confidence": 0-100,
  "language": "en|hinglish|hi",
  "response": "message (markdown bold OK, max 3 sentences)",
  "flow_name": "exact key or null",
  "flow_cancel": false,
  "flow_complete": false,
  "slot_filled": "slot name or null",
  "slot_value": "extracted value or null",
  "next_slot": "next slot name or null",
  "clarify_options": ["opt1","opt2"] or null,
  "frustration_signal": false,
  "deep_link": "button label or null",
  "compliance_citation": "FAQ-ID or MITC-field or null"
}`;
}

// ─── Call Gemini API ──────────────────────────────────────────────────────────
async function callGemini(systemPrompt, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 800,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // 12s — more forgiving

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini response");

    const parsed = JSON.parse(text);
    return validateLLMResponse(parsed);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Gemini timeout");
    throw err;
  }
}

// ─── Validate + sanitize LLM response ────────────────────────────────────────
function validateLLMResponse(r) {
  const validRoutes = ["A", "B", "C", "D", "E"];
  const validLanguages = ["en", "hinglish", "hi"];
  const validFlows = Object.keys(FLOWS);

  return {
    route: validRoutes.includes(r.route) ? r.route : "B",
    intent: typeof r.intent === "string" ? r.intent.slice(0, 100) : "unknown",
    confidence: typeof r.confidence === "number" ? Math.min(100, Math.max(0, r.confidence)) : 70,
    language: validLanguages.includes(r.language) ? r.language : "en",
    response: typeof r.response === "string" ? r.response.slice(0, 800) : "How can I help you?",
    flow_name: validFlows.includes(r.flow_name) ? r.flow_name : null,
    flow_cancel: r.flow_cancel === true,
    flow_complete: r.flow_complete === true,
    slot_filled: typeof r.slot_filled === "string" ? r.slot_filled : null,
    slot_value: r.slot_value !== undefined && r.slot_value !== null ? String(r.slot_value).slice(0, 200) : null,
    next_slot: typeof r.next_slot === "string" ? r.next_slot : null,
    clarify_options: Array.isArray(r.clarify_options) && r.clarify_options.length === 2
      ? r.clarify_options.map((o) => String(o).slice(0, 60))
      : null,
    intent_type: ["informational", "transactional", "ambiguous"].includes(r.intent_type) ? r.intent_type : null,
    frustration_signal: r.frustration_signal === true,
    deep_link: typeof r.deep_link === "string" ? r.deep_link : null,
    compliance_citation: typeof r.compliance_citation === "string" ? r.compliance_citation : null,
  };
}

// ─── Main chat endpoint ───────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, sessionState = {} } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message required" });
  }

  // Prototype OTP auto-verify: complete the pending OTP-required flow immediately
  if (message.trim() === "__otp_verified__") {
    const flowName = sessionState.currentFlow;
    if (flowName && FLOWS[flowName]) {
      const flow = FLOWS[flowName];
      const slots = sessionState.collectedSlots || {};
      const nextSlot = sessionState.nextSlot;

      if (nextSlot) {
        // Still has slots to fill — ask for the next one
        return res.json({
          tier: "OTP", route: "A",
          response: flow.slotPrompts[nextSlot],
          flow_name: flowName, flow_complete: false, next_slot: nextSlot,
          sessionState,
        });
      } else {
        // All slots collected — complete the flow
        const completionMsg = flow.completion(slots, MOCK_USER);
        const newState = { ...sessionState, currentFlow: null, collectedSlots: {}, nextSlot: null };
        return res.json({
          tier: "OTP", route: "A",
          response: completionMsg,
          flow_name: flowName, flow_complete: true,
          deep_link: flow.deepLink || null,
          sessionState: newState,
        });
      }
    }
    // No active flow — just acknowledge
    return res.json({
      tier: "OTP", route: "A",
      response: "Verified. How can I help you?",
      sessionState,
    });
  }

  // PII redact FIRST, then truncate
  const safeMessage = redactPII(message.trim()).slice(0, 500);

  // Injection check
  if (scanForInjection(safeMessage)) {
    return res.json({
      tier: "SECURITY", route: "E",
      response: "I can only help with OneCard and BOBCARD queries.",
      sessionState,
    });
  }

  const frustrationScore = Math.min(1, Math.max(0, sessionState.frustrationScore || 0));
  const { isInstant, isFrustrated } = detectFrustration(safeMessage);

  // Instant escalation (explicit agent request) — no cooldown needed
  if (isInstant) {
    return res.json({
      tier: "ESCALATION", route: "D",
      response: "Let me connect you with a team member right away. They'll have your full conversation history so you won't need to repeat anything.",
      deep_link: "Connect to Agent",
      sessionState: { ...sessionState, frustrationScore: 0, currentFlow: null, lastEscalation: Date.now() },
    });
  }

  // Frustration threshold — with cooldown to prevent infinite loop
  const lastEscalation = sessionState.lastEscalation || 0;
  const cooldownMs = 3 * 60 * 1000; // 3 min cooldown between auto-escalations
  const canEscalate = Date.now() - lastEscalation > cooldownMs;

  if ((isFrustrated || frustrationScore >= 0.70) && canEscalate) {
    return res.json({
      tier: "FRUSTRATION", route: "D",
      response: "I hear that this isn't working for you. Let me connect you with a team member who can help — they'll have full context of your conversation.",
      deep_link: "Connect to Agent",
      sessionState: { ...sessionState, frustrationScore: 0.3, currentFlow: null, lastEscalation: Date.now() },
    });
  }

  // Tier 1: Static MITC match (fees/rates — zero hallucination path)
  // Skip T1 when user is mid-flow — flow state takes priority over static intercept
  const t1 = sessionState.currentFlow ? { matched: false } : tier1Match(safeMessage);
  if (t1.matched) {
    return res.json({
      tier: "T1_STATIC", route: "A",
      response: t1.response,
      compliance_citation: `MITC — ${t1.key}`,
      sessionState,
    });
  }

  // Pre-LLM analysis — used for sanity overrides
  const faqScores = scoreFAQs(safeMessage);
  const topFAQ = faqScores[0];
  // resolveIntentType is the single source of truth for FAQ vs Flow in server-side logic.
  // Gemini's own intent_type field (returned in llmResult) is preferred at Gate 5 below;
  // this is used for Gate 3 (ambiguity) and as the fallback when Gemini is unavailable.
  const intentType = resolveIntentType(safeMessage);
  const wordCount = safeMessage.trim().split(/\s+/).length;

  // Route C trigger: ambiguous short queries (1-2 words) that match both flow and FAQ
  // e.g. "card block", "account close", "emi", "dispute"
  if (!sessionState.currentFlow && wordCount <= 2 && intentType === "ambiguous") {
    const ambiguousTerms = {
      "block": ["Block my card now", "Tell me how card blocking works"],
      "close": ["Close my account", "Tell me about account closure"],
      "emi": ["Convert a transaction to EMI", "Tell me how EMI works"],
      "dispute": ["File a dispute", "Tell me how disputes work"],
      "pin": ["Change my PIN", "How PIN reset works"],
      "autopay": ["Set up autopay", "Tell me how autopay works"],
    };
    const matchedTerm = Object.keys(ambiguousTerms).find((t) => safeMessage.toLowerCase().includes(t));
    if (matchedTerm) {
      return res.json({
        tier: "T2_AMBIGUITY", route: "C",
        intent: `ambiguous_${matchedTerm}`,
        response: `Did you want to perform an action or learn more?`,
        clarify_options: ambiguousTerms[matchedTerm],
        flow_name: null,
        sessionState,
      });
    }
  }

  // Tier 3: Gemini LLM — primary intelligence
  try {
    const intentGuess = guessIntent(safeMessage, sessionState);
    const userContext = getSelectiveContext(intentGuess);
    const relevantFAQs = findRelevantFAQs(safeMessage);
    const systemPrompt = buildSystemPrompt(userContext, relevantFAQs, sessionState);

    const llmResult = await callGemini(systemPrompt, safeMessage);

    // ── Gate 5: FAQ override ──────────────────────────────────────────────────
    // Use Gemini's own intent_type as primary signal (it read the full sentence semantically).
    // Fall back to resolveIntentType() when Gemini didn't return intent_type.
    // Override Gemini's flow_name → null when:
    //   1. effective intent is "informational", AND
    //   2. a FAQ scored ≥ 4 (at least one tag hit = 3pts + any word overlap), AND
    //   3. no active flow already in progress
    const effectiveIntentType = llmResult.intent_type || intentType;
    if (effectiveIntentType === "informational" &&
        topFAQ && topFAQ.score >= 4 &&
        llmResult.flow_name && !sessionState.currentFlow && !llmResult.flow_complete) {
      llmResult.flow_name = null;
      llmResult.flow_complete = false;
      llmResult.next_slot = null;
      llmResult.requires_otp = false;
      llmResult.compliance_citation = llmResult.compliance_citation || topFAQ.faq.id;
      // Keep LLM's response text — it was generated with FAQ context already injected
    }

    // Hardcoded OTP rule — LLM cannot override
    if (llmResult.flow_name && requiresOtp(llmResult.flow_name)) {
      llmResult.requires_otp = true;
    }

    // ── Gap 4: Multi-intent enforcement ──────────────────────────────────────
    // When message has both a transactional AND informational component
    // (e.g. "card block karo aur interest rate bhi batao"), Gemini may answer
    // only the transactional part. Detect this server-side and append the FAQ
    // answer inline so the user gets both in one response.
    const MULTI_INTENT_RE = /\b(and|aur|bhi|also|plus|saath|साथ)\b/i;
    if (!sessionState.currentFlow && llmResult.flow_name && !llmResult.flow_complete &&
        MULTI_INTENT_RE.test(safeMessage) && topFAQ && topFAQ.score >= 4) {
      // There's a flow being started AND a strong FAQ hit — append FAQ inline
      const faqSentences = topFAQ.faq.answer.split(/(?<=[.!?])\s+/);
      const faqSnippet = faqSentences.slice(0, 2).join(" ");
      llmResult.response = llmResult.response + `\n\n**Also:** ${faqSnippet} *(${topFAQ.faq.id})*`;
    }

    // Mid-flow interruption guard: if active flow was set and user asked a question,
    // LLM should have preserved flow_name/next_slot. If it didn't, restore them.
    if (sessionState.currentFlow && !llmResult.flow_cancel && !llmResult.flow_complete) {
      const midFlowIntentType = llmResult.intent_type || intentType;
      const isInterruption = midFlowIntentType === "informational";
      const filledSlot = llmResult.slot_filled;
      // If it's a question AND the LLM dropped flow context, restore it
      if (isInterruption && !filledSlot && !llmResult.flow_name) {
        llmResult.flow_name = sessionState.currentFlow;
        llmResult.next_slot = sessionState.nextSlot;
      }
      // If LLM filled a slot with the question text verbatim (bad fill), reject it
      if (filledSlot && llmResult.slot_value && isInterruption &&
          /\b(kya|what|hota|kaise|kyun|explain|samjhao|batao)\b/.test(llmResult.slot_value.toLowerCase())) {
        // Bad slot fill — treat as interruption instead
        const flow = FLOWS[sessionState.currentFlow];
        const nextSlot = sessionState.nextSlot;
        llmResult.slot_filled = null;
        llmResult.slot_value = null;
        llmResult.flow_complete = false;
        llmResult.flow_name = sessionState.currentFlow;
        llmResult.next_slot = nextSlot;
        if (flow && nextSlot) {
          llmResult.response = llmResult.response + ` Back to **${flow.name}** — ${flow.slotPrompts[nextSlot]}`;
        }
      }
    }

    // Account closure preCheck — server always injects prerequisites when flow starts
    // Also catch cases where LLM gave info response instead of starting the flow
    const closureKeywords = /\b(account\s*(close|band|closure|bandh)|close\s*(my\s*)?account|permanently\s*close)\b/i;
    if (closureKeywords.test(safeMessage) && !sessionState.currentFlow) {
      llmResult.flow_name = "account_closure";
    }
    if (llmResult.flow_name === "account_closure" && !sessionState.currentFlow) {
      const flow = FLOWS.account_closure;
      const issues = flow.preCheck(MOCK_USER);
      if (issues.length > 0) {
        const prereqList = issues.map((i) => `• ${i}`).join("\n");
        llmResult.response = `Before closing your account, please clear the following:\n\n${prereqList}\n\nOnce resolved, type **CLOSE MY ACCOUNT** to confirm. This is permanent.`;
        llmResult.next_slot = "confirm";
      }
    }

    // Server-side slot validation for active flows — LLM may skip this
    if (sessionState.currentFlow && sessionState.nextSlot && llmResult.slot_filled) {
      const slotVal = llmResult.slot_value || safeMessage;
      const validation = validateSlotInput(sessionState.currentFlow, sessionState.nextSlot, slotVal);
      if (!validation.ok) {
        llmResult.response = validation.message;
        llmResult.flow_complete = false;
        llmResult.slot_filled = null;
        llmResult.slot_value = null;
        llmResult.next_slot = sessionState.nextSlot; // keep slot open
      } else if (sessionState.currentFlow === "account_closure" && sessionState.nextSlot === "confirm") {
        // Force completion — LLM often just re-explains instead of completing
        const allSlots = { ...(sessionState.collectedSlots || {}), confirm: slotVal };
        const completionMsg = FLOWS.account_closure.completion(allSlots, MOCK_USER);
        llmResult.response = completionMsg;
        llmResult.flow_complete = true;
        llmResult.next_slot = null;
        llmResult.flow_name = "account_closure";
      }
    }

    // Handle 0-slot flows: if flow triggered and no slots needed, complete immediately
    if (llmResult.flow_name && !llmResult.flow_complete && !llmResult.next_slot) {
      const flow = FLOWS[llmResult.flow_name];
      if (flow && flow.slots.length === 0) {
        const completionMsg = flow.completion({}, MOCK_USER);
        llmResult.response = completionMsg;
        llmResult.flow_complete = true;
        llmResult.deep_link = flow.deepLink || null;
      }
    }

    const newSessionState = updateSessionState(sessionState, llmResult);

    // Frustration score update
    let newScore = frustrationScore;
    if (llmResult.frustration_signal) newScore = Math.min(1, newScore + 0.25);
    else if (isFrustrated) newScore = Math.min(1, newScore + 0.15);
    if (llmResult.route === "A" && llmResult.flow_complete) newScore = Math.max(0, newScore - 0.15);
    else if (llmResult.route === "A" || llmResult.route === "B") newScore = Math.max(0, newScore - 0.05);
    newSessionState.frustrationScore = newScore;
    newSessionState.lastEscalation = sessionState.lastEscalation || 0;

    return res.json({ tier: "T3_LLM", ...llmResult, sessionState: newSessionState });

  } catch (err) {
    console.error("LLM error:", err.message.slice(0, 100));

    // Tier 2: Rule-based fallback when Gemini unavailable
    const demoResult = demoRouter(safeMessage, sessionState);
    if (demoResult) {
      const newSessionState = updateSessionState(sessionState, demoResult);
      newSessionState.frustrationScore = frustrationScore;
      newSessionState.lastEscalation = sessionState.lastEscalation || 0;
      return res.json({ tier: "T2_DEMO", ...demoResult, sessionState: newSessionState });
    }

    return res.json({
      tier: "FALLBACK", route: "D",
      response: "I'm having trouble connecting right now. Let me get a team member to help you immediately.",
      deep_link: "Connect to Agent",
      sessionState,
    });
  }
});

// ─── Demo/fallback router ─────────────────────────────────────────────────────
function demoRouter(text, sessionState) {
  const lower = text.toLowerCase();
  const user = MOCK_USER;

  // ── Active flow slot-filling ──
  if (sessionState.currentFlow) {
    const flow = FLOWS[sessionState.currentFlow];
    if (!flow) {
      // Invalid flow in state — clean up
      return { route: "A", intent: "flow_reset", confidence: 90, language: "en",
        response: "Something went wrong with your previous request. How can I help you?",
        flow_cancel: true, flow_name: null, frustration_signal: false };
    }

    const nextSlot = sessionState.nextSlot;

    // Cancel signal
    if (lower.match(/\b(cancel|nevermind|nahi\s*chahi?ye|rukk|nahi\s*karna|mat\s*karo|rehne\s*do|nahi\s*chahta|band\s*karo\s*ye)\b/)) {
      return { route: "A", intent: "cancel_flow", confidence: 95, language: "en",
        response: "Your request has been cancelled. How else can I help you?",
        flow_cancel: true, flow_name: null, frustration_signal: false };
    }

    // Zero-slot flow triggered (complete immediately)
    if (flow.slots.length === 0) {
      const msg = flow.completion({}, user);
      return {
        route: "A", intent: `complete_${sessionState.currentFlow}`, confidence: 98, language: "en",
        response: msg,
        flow_name: sessionState.currentFlow, flow_cancel: false, flow_complete: true,
        next_slot: null, deep_link: flow.deepLink || null, frustration_signal: false,
        requires_otp: requiresOtp(sessionState.currentFlow),
      };
    }

    // Fill next slot
    if (nextSlot) {
      // ── Interruption guard: any question mid-flow gets answered then flow resumes ──
      // Permanent fix: use FAQ scoring + account data lookup instead of keyword lists.
      // Any new FAQ added to faqs.js automatically works here — zero maintenance.
      const isQuestion = /\b(kya|what|how|kaise|kyun|why|kaun|which|when|kab|explain|batao|samjhao)\b|\?/.test(lower);
      if (isQuestion) {
        let answer = "";

        // 1. Account data questions — answered from live user data
        if (lower.match(/\b(balance|outstanding|baaki|dues?|kitna\s*baki)\b/))
          answer = `Aapka outstanding ₹${user.outstanding.toLocaleString("en-IN")} hai (due ${user.dueDate}). `;
        else if (lower.match(/\b(reward|points?|cashback)\b/))
          answer = `Aapke paas ${user.rewardPoints} points hain (₹${user.pointValue.toFixed(2)} value). `;
        else if (lower.match(/\b(statement)\b/))
          answer = `Statement date ${user.statementDate} hai, due date ${user.dueDate}. `;
        else if (lower.match(/\b(credit\s*limit|available\s*credit|kitna\s*available)\b/))
          answer = `Credit limit ₹${user.creditLimit.toLocaleString("en-IN")}, available ₹${user.availableCredit.toLocaleString("en-IN")}. `;
        else if (lower.match(/\b(transaction|last\s*spend|recent)\b/)) {
          const t = user.lastTransactions[0];
          answer = `Last transaction: ${t.merchant} ₹${t.amount} on ${t.date}. `;
        }

        // 2. Knowledge questions — answered from FAQ scoring (permanent, self-updating)
        if (!answer) {
          const faqHit = scoreFAQs(text).find(s => s.score >= 3);
          if (faqHit) {
            // Trim FAQ answer to 1-2 sentences so it doesn't overwhelm the flow redirect
            const sentences = faqHit.faq.answer.split(/(?<=[.!?])\s+/);
            answer = sentences.slice(0, 2).join(" ") + " ";
          }
        }

        // 3. No match — generic redirect (rare — FAQ scoring catches almost everything)
        return {
          route: "A", intent: "flow_interruption", confidence: 90, language: "hinglish",
          response: `${answer}Back to **${flow.name}** — ${flow.slotPrompts[nextSlot]}`,
          flow_name: sessionState.currentFlow, flow_cancel: false, flow_complete: false,
          slot_filled: null, slot_value: null, next_slot: nextSlot, frustration_signal: false,
        };
      }

      // Slot-level validation before accepting
      const validation = validateSlotInput(sessionState.currentFlow, nextSlot, text);
      if (!validation.ok) {
        return {
          route: "A", intent: `slot_invalid_${nextSlot}`, confidence: 95, language: "en",
          response: validation.message,
          flow_name: sessionState.currentFlow, flow_cancel: false, flow_complete: false,
          slot_filled: null, slot_value: null, next_slot: nextSlot, frustration_signal: false,
        };
      }

      const slots = { ...(sessionState.collectedSlots || {}), [nextSlot]: text };
      const remaining = flow.slots.filter((s) => !slots[s]);

      if (remaining.length === 0) {
        const msg = flow.completion(slots, user);
        return {
          route: "A", intent: `complete_${sessionState.currentFlow}`, confidence: 98, language: "en",
          response: msg,
          flow_name: sessionState.currentFlow, flow_cancel: false, flow_complete: true,
          slot_filled: nextSlot, slot_value: text, next_slot: null,
          deep_link: flow.deepLink || null, frustration_signal: false,
          requires_otp: requiresOtp(sessionState.currentFlow),
        };
      } else {
        const nextNeeded = remaining[0];
        return {
          route: "A", intent: `slot_fill_${nextSlot}`, confidence: 95, language: "en",
          response: flow.slotPrompts[nextNeeded],
          flow_name: sessionState.currentFlow, flow_cancel: false, flow_complete: false,
          slot_filled: nextSlot, slot_value: text, next_slot: nextNeeded, frustration_signal: false,
        };
      }
    }
  }

  // ── No active flow — intent routing ──

  // Use resolveIntentType() — single source of truth, handles tiebreak correctly.
  // isInfoQ = true means informational; action branches guard with !isInfoQ.
  const isInfoQ = resolveIntentType(text) === "informational";

  if (lower.match(/\b(cancel|nevermind|nahi\s*chahiye)\b/)) {
    return { route: "A", intent: "cancel", confidence: 90, language: "en",
      response: "No problem. How can I help you?", flow_cancel: true, flow_name: null, frustration_signal: false };
  }

  // ── Informational / FAQ-first section ──
  // These patterns answer questions about HOW things work before checking if user wants to DO them.

  // "credit limit kya hai", "available credit kya hota hai", "dono mein kya fark"
  if (isInfoQ && lower.match(/\b(credit\s*limit|available\s*credit|limit\s*kya|antar|difference)\b/)) {
    return { route: "A", intent: "credit_limit_info", confidence: 92, language: "hinglish",
      response: `**Credit limit** woh maximum amount hai jo aap spend kar sakte hain (e.g., ₹${user.creditLimit.toLocaleString("en-IN")}).\n\n**Available credit** = Credit limit − Current outstanding = ₹${user.availableCredit.toLocaleString("en-IN")} abhi aapke liye available hai.\n\nBill pay karte hi available credit restore ho jaata hai.`,
      flow_name: null, frustration_signal: false, compliance_citation: "FAQ-024" };
  }

  // "interest kaise bachein", "interest se kaise bachu"
  if (isInfoQ && lower.match(/\b(interest|byaj)\b/) && lower.match(/\b(bachu|avoid|kam|reduce|zero|free|nahi\s*dena)\b/)) {
    return { route: "A", intent: "avoid_interest", confidence: 94, language: "hinglish",
      response: `Interest se bachne ka sabse aasaan tarika: **due date (${user.dueDate}) se pehle full outstanding pay kar do**.\n\n• Full payment → 0% interest, up to 48 days free credit\n• Minimum due only → 3.75%/month interest poore unpaid balance par\n• Autopay "Full outstanding" set karo — safest option`,
      flow_name: null, frustration_signal: false, compliance_citation: "FAQ-025" };
  }

  // "block kaise kaam karta hai", "blocking kya hota hai"
  if (isInfoQ && lower.match(/\b(block|freeze)\b/) && !lower.match(/\b(unblock|unlock)\b/)) {
    return { route: "A", intent: "card_block_info", confidence: 92, language: "hinglish",
      response: `Card block karne se **saare naye transactions turant band** ho jaate hain — online, in-store, contactless sab.\n\n• Existing EMIs aur refunds normally continue karte hain\n• **Temporary block**: app se kabhi bhi unblock kar sakte ho\n• **Permanent block** (lost/stolen): replacement card 7-10 working days mein`,
      flow_name: null, frustration_signal: false, compliance_citation: "FAQ-021" };
  }

  // "dispute kya hai", "dispute kaise kaam karta hai"
  if (isInfoQ && lower.match(/\b(dispute|chargeback)\b/)) {
    return { route: "A", intent: "dispute_info", confidence: 92, language: "hinglish",
      response: `**Dispute** ek formal complaint hai kisi transaction ke against jo aapne authorize nahi ki, mili nahi, ya galat charge ki gayi.\n\n• File karne ki window: **statement date se 30 din**\n• Resolution SLA: **30 days** (RBI mandate)\n• Eligible hone par provisional credit 10 days mein\n• Status app → Transactions → Disputes mein check kar sakte ho`,
      flow_name: null, frustration_signal: false, compliance_citation: "FAQ-022" };
  }

  // "pin kya hota hai", "pin kaise milega", "pin bhool gaya"
  if (isInfoQ && lower.match(/\b(pin)\b/)) {
    return { route: "A", intent: "pin_info", confidence: 90, language: "hinglish",
      response: `PIN reset karne ke liye: **app → Cards → Change PIN**.\n\nOTP verify hoga, phir ek secure link milega — wahan directly naya PIN set kar sakte ho. Purana PIN yaad nahi hai tab bhi yahi process kaam karta hai.`,
      flow_name: null, frustration_signal: false, compliance_citation: "FAQ-023" };
  }

  // "emi kya hota hai", "emi kaise kaam karta hai", "emi samjhao"
  if (lower.match(/\b(emi|installment|kist)\b/)) {
    // Foreclose check FIRST — "emi foreclose karna hai" must not fall into convert branch
    if (lower.match(/\b(foreclose|foreclos|band\s*karo|early\s*pay|prepay|close\s*emi)\b/) && !isInfoQ) {
      return { route: "A", intent: "emi_foreclosure", confidence: 90, language: "en",
        response: FLOWS.emi_foreclosure.slotPrompts.emi_select,
        flow_name: "emi_foreclosure", flow_cancel: false, flow_complete: false,
        next_slot: "emi_select", frustration_signal: false };
    }
    if (isInfoQ && lower.match(/\b(kya|what|hota|samjhao|batao|explain|matlab|mean|kaam\s*karta)\b/)) {
      return { route: "A", intent: "emi_concept", confidence: 92, language: "hinglish",
        response: `**EMI (Equated Monthly Instalment)** ek badi purchase ko chhoti monthly payments mein tod deta hai.\n\n• Eligible: ₹1,500+ ka koi bhi transaction\n• Tenures: 3, 6, 9, ya 12 months\n• Processing fee: 1% (min ₹99)\n• Convert window: transaction ke 30 din ke andar\n• EMI monthly bill mein add hota hai — alag se pay nahi karna`,
        flow_name: null, frustration_signal: false, compliance_citation: "FAQ-011" };
    }
    if (isInfoQ && lower.match(/\b(repay|repayment|kaise\s*(bhar|pay|dete|karte)|bharna)\b/)) {
      return { route: "A", intent: "emi_repayment", confidence: 90, language: "hinglish",
        response: `EMI automatically aapke monthly bill mein add ho jaata hai — alag se kuch nahi karna. Monthly credit card bill pay karo (app, UPI, NEFT, ya net banking se), EMI included hoga.\n\nForeclosure: app → EMI → Foreclose (3% fee applicable).`,
        flow_name: null, frustration_signal: false, compliance_citation: "FAQ-011" };
    }
    // Action: convert karna hai
    if (lower.match(/\b(convert|karna|chahiye|start|shuru|banana|lena)\b/)) {
      return { route: "A", intent: "emi_conversion", confidence: 88, language: "en",
        response: FLOWS.emi_conversion.slotPrompts.transaction,
        flow_name: "emi_conversion", flow_cancel: false, flow_complete: false,
        next_slot: "transaction", frustration_signal: false };
    }
    // Generic EMI mention → status
    return { route: "A", intent: "emi_query", confidence: 88, language: "en",
      response: `You have **1 active EMI**: Amazon ₹3,750/month (8 months remaining).\n\nEMI processing fee: 1% (min ₹99) · Foreclosure: 3% (min ₹99).`,
      flow_name: null, frustration_signal: false, compliance_citation: "MITC — EMI" };
  }

  // "repayment kaise karte hain", "bill kaise bharte hain"
  if (isInfoQ && lower.match(/\b(repay|repayment|kaise\s*(bhar|karte|karu|karein|dete|pay)|bill\s*kaise)\b/)) {
    return { route: "A", intent: "repayment_how", confidence: 92, language: "hinglish",
      response: `Apna OneCard bill pay karne ke 4 tarike:\n\n• **OneCard app** → Pay Bill (fastest)\n• **UPI** — card ka virtual account UPI ID use karein\n• **NEFT/IMPS** — card ke virtual account number pe\n• **Net banking** — credit card payment option se\n\nDue date: **${user.dueDate}** · Outstanding: **₹${user.outstanding.toLocaleString("en-IN")}**`,
      flow_name: null, deep_link: "Pay Now", frustration_signal: false, compliance_citation: "FAQ-006" };
  }

  // ── Account / data queries (always informational) ──
  // NOTE: limit_increase action check must come BEFORE balance_query to avoid
  // "credit limit increase chahiye" being caught by the credit_limit keyword below.

  if (lower.match(/\b(balance|outstanding|kitna\s*bak[iy]|available\s*credit|baaki|paisa\s*baki|dues?)\b/) ||
      (lower.match(/credit\s*limit/) && !lower.match(/increase|badh|badhao|enhance|request|chahiye/))) {
    return { route: "A", intent: "balance_query", confidence: 92, language: "en",
      response: `Your outstanding is **₹${user.outstanding.toLocaleString("en-IN")}** (min due ₹${user.minimumDue.toLocaleString("en-IN")}) due **${user.dueDate}**.\n\nAvailable credit: ₹${user.availableCredit.toLocaleString("en-IN")} of ₹${user.creditLimit.toLocaleString("en-IN")}.`,
      flow_name: null, frustration_signal: false, compliance_citation: "Account data" };
  }

  if (lower.match(/\b(transaction|recent|last\s*spend|last\s*purchase|kharch|spend)\b/)) {
    const txns = user.lastTransactions.map((t) => `• ${t.merchant}: ₹${t.amount.toLocaleString("en-IN")} (${t.date})`).join("\n");
    return { route: "A", intent: "transaction_history", confidence: 88, language: "en",
      response: `Your recent transactions:\n\n${txns}`,
      flow_name: null, frustration_signal: false };
  }

  if (lower.match(/\b(reward|point|redeem|cashback)\b/)) {
    return { route: "A", intent: "rewards_query", confidence: 92, language: "en",
      response: `You have **${user.rewardPoints} reward points** worth ₹${user.pointValue.toFixed(2)}. Minimum 500 points for redemption.`,
      flow_name: null, deep_link: "Redeem Points", frustration_signal: false, compliance_citation: "MITC — Reward Point Value" };
  }

  // ── Ambiguous ──

  // "account band" — could be block or closure
  if (lower.match(/account\s+ba+nd/) && !lower.match(/\b(close|closure|permanently|hamesha)\b/)) {
    return { route: "C", intent: "ambiguous_block_or_closure", confidence: 55, language: "hinglish",
      response: "Kya aap apna **card temporarily block** karna chahte hain, ya **account permanently close** karna chahte hain?",
      flow_name: null, clarify_options: ["Card block (temporary)", "Account closure (permanent)"], frustration_signal: false };
  }

  // ── Action flows ──

  if (lower.match(/\b(unblock|unlock|activate\s*card|card\s*chalu)\b/)) {
    const msg = FLOWS.card_unblock.completion({}, user);
    return { route: "A", intent: "card_unblock", confidence: 90, language: "en",
      response: msg,
      flow_name: null, flow_cancel: false, flow_complete: true,
      next_slot: null, frustration_signal: false };
  }

  if (lower.match(/\b(block|lost|chori|stolen|suspicious|gum\s*gaya|kho\s*gaya)\b/) && !isInfoQ) {
    return { route: "A", intent: "card_block", confidence: 90, language: "en",
      response: FLOWS.card_block.slotPrompts.block_reason,
      flow_name: "card_block", flow_cancel: false, flow_complete: false,
      next_slot: "block_reason", frustration_signal: false, requires_otp: true };
  }

  if (lower.match(/\b(close\s*account|account\s*close|account\s*ba+nd|permanently\s*close)\b/)) {
    const flow = FLOWS.account_closure;
    const issues = flow.preCheck(user);
    const prereqList = issues.map((i) => `• ${i}`).join("\n");
    return { route: "A", intent: "account_closure", confidence: 88, language: "en",
      response: `Before closing your account, please clear the following:\n\n${prereqList}\n\nOnce resolved, type **CLOSE MY ACCOUNT** to confirm. This is permanent.`,
      flow_name: "account_closure", flow_cancel: false, flow_complete: false,
      next_slot: "confirm", frustration_signal: false, compliance_citation: "MITC — Closure" };
  }

  if (lower.match(/\b(dispute|wrong\s*charge|galat\s*charge|unauthorized|unknown\s*transaction)\b/) && !isInfoQ) {
    return { route: "A", intent: "dispute_filing", confidence: 88, language: "en",
      response: FLOWS.dispute_filing.slotPrompts.transaction,
      flow_name: "dispute_filing", flow_cancel: false, flow_complete: false,
      next_slot: "transaction", frustration_signal: false };
  }

  if (lower.match(/\b(pay|payment|bill\s*pay|bhugtan|bhugtaan|jama)\b/)) {
    const msg = FLOWS.bill_payment.completion({}, user);
    return { route: "A", intent: "bill_payment", confidence: 90, language: "en",
      response: msg, flow_name: null, deep_link: "Pay Now", frustration_signal: false };
  }

  if (lower.match(/\b(statement|download\s*statement|pdf)\b/)) {
    const msg = FLOWS.statement_download.completion({}, user);
    return { route: "A", intent: "statement_download", confidence: 90, language: "en",
      response: msg, flow_name: null, deep_link: "Download Statement", frustration_signal: false };
  }

  if (lower.match(/\b(replace|replacement|damaged|naya\s*card)\b/)) {
    return { route: "A", intent: "card_replacement", confidence: 88, language: "en",
      response: FLOWS.card_replacement.slotPrompts.reason,
      flow_name: "card_replacement", flow_cancel: false, flow_complete: false,
      next_slot: "reason", frustration_signal: false, requires_otp: true };
  }

  if (lower.match(/\b(address|pata)\b/) && lower.match(/\b(change|badal|update|naya|new|karna|chahiye)\b/) && !isInfoQ) {
    return { route: "A", intent: "address_change", confidence: 88, language: "en",
      response: FLOWS.address_change.slotPrompts.new_address + " (OTP required for security.)",
      flow_name: "address_change", flow_cancel: false, flow_complete: false,
      next_slot: "new_address", frustration_signal: false, requires_otp: true };
  }

  if (lower.match(/\b(pin)\b/) && lower.match(/\b(change|badal|reset|bhool|new|naya|karna|chahiye)\b/) && !isInfoQ) {
    const msg = FLOWS.pin_change.completion({}, user);
    return { route: "A", intent: "pin_change", confidence: 88, language: "en",
      response: msg, flow_name: null, flow_complete: true, frustration_signal: false, requires_otp: true };
  }

  if (lower.match(/\b(autopay|auto\s*pay|auto\s*debit|nach|standing\s*instruction)\b/) && !isInfoQ) {
    return { route: "A", intent: "autopay_setup", confidence: 88, language: "en",
      response: FLOWS.autopay_setup.slotPrompts.autopay_type,
      flow_name: "autopay_setup", flow_cancel: false, flow_complete: false,
      next_slot: "autopay_type", frustration_signal: false };
  }

  if (lower.match(/\b(foreclose|foreclose\s*emi|emi\s*band\s*karo|early\s*pay|emi\s*close|prepay\s*emi)\b/) && !isInfoQ) {
    return { route: "A", intent: "emi_foreclosure", confidence: 88, language: "en",
      response: FLOWS.emi_foreclosure.slotPrompts.emi_select,
      flow_name: "emi_foreclosure", flow_cancel: false, flow_complete: false,
      next_slot: "emi_select", frustration_signal: false };
  }

  if (lower.match(/\b(limit\s*increase|credit\s*limit\s*badh|enhance\s*limit|limit\s*badhao|increase\s*limit|credit\s*limit\s*request)\b/) && !isInfoQ) {
    return { route: "A", intent: "limit_increase", confidence: 88, language: "en",
      response: FLOWS.limit_increase.slotPrompts.amount,
      flow_name: "limit_increase", flow_cancel: false, flow_complete: false,
      next_slot: "amount", frustration_signal: false };
  }

  if (lower.match(/\b(fraud|fraudulent|scam|hacked|unauthorized\s*transaction|mujhe\s*hack|mera\s*card\s*hack)\b/) && !isInfoQ) {
    return { route: "A", intent: "fraud_report", confidence: 90, language: "en",
      response: FLOWS.fraud_report.slotPrompts.txn_details,
      flow_name: "fraud_report", flow_cancel: false, flow_complete: false,
      next_slot: "txn_details", frustration_signal: false };
  }

  if (lower.match(/\b(privacy\s*setting|marketing\s*notif|data\s*shar|email\s*prefer|notification\s*setting|privacy\s*update|notif\s*band|notif\s*on)\b/) || (lower.match(/\b(privacy)\b/) && lower.match(/\b(update|change|setting|karna|chahiye)\b/)) && !isInfoQ) {
    return { route: "A", intent: "privacy_settings", confidence: 85, language: "en",
      response: FLOWS.privacy_settings.slotPrompts.preference_type,
      flow_name: "privacy_settings", flow_cancel: false, flow_complete: false,
      next_slot: "preference_type", frustration_signal: false };
  }

  if (lower.match(/\b(escalate|escalation|talk\s*to\s*(agent|human|person)|senior\s*agent|support\s*ticket|raise\s*ticket|ticket\s*raise|agent\s*se\s*baat|insaan\s*chahiye|human\s*agent)\b/) && !isInfoQ) {
    return { route: "A", intent: "support_escalation", confidence: 88, language: "en",
      response: FLOWS.support_escalation.slotPrompts.issue_category,
      flow_name: "support_escalation", flow_cancel: false, flow_complete: false,
      next_slot: "issue_category", frustration_signal: false };
  }

  if (lower.match(/\b(weather|cricket|movie|joke|khana\s*order|food|politics|news|ipl)\b/)) {
    return { route: "E", intent: "out_of_scope", confidence: 95, language: "en",
      response: "I can only help with OneCard and BOBCARD queries. What would you like to know about your card?",
      flow_name: null, frustration_signal: false };
  }

  if (lower.match(/\b(hi|hello|hey|namaste|help|start|kya\s*kar\s*sakte|what\s*can\s*you)\b/)) {
    return { route: "A", intent: "greeting", confidence: 95, language: "en",
      response: "I can help you with:\n\n• **Balance & payments** — outstanding, pay bill, autopay\n• **Card** — block, unblock, replace\n• **EMI** — convert transactions, check active EMIs\n• **Rewards** — check points, redeem\n• **Account** — disputes, statements, address change, closure\n• **Rates & fees** — interest, charges (MITC)",
      flow_name: null, frustration_signal: false };
  }

  // ── FAQ fallback: try tag-based lookup before giving up ──
  const topFaqMatch = scoreFAQs(text).find((s) => s.score >= 4);
  if (topFaqMatch) {
    return { route: "A", intent: "faq_fallback", confidence: 75, language: "en",
      response: topFaqMatch.faq.answer,
      flow_name: null, frustration_signal: false, compliance_citation: topFaqMatch.faq.id };
  }

  return { route: "B", intent: "unknown", confidence: 40, language: "en",
    response: "I can help with your OneCard account — balance, card block/unblock, EMI, payments, disputes, and more. What do you need?",
    flow_name: null, frustration_signal: false };
}

// ─── Guess intent for context selection ──────────────────────────────────────
function guessIntent(text, sessionState) {
  if (sessionState.currentFlow) return sessionState.currentFlow;
  const lower = text.toLowerCase();
  if (lower.match(/balance|outstanding|due|credit\s*limit/)) return "balance_query";
  if (lower.match(/emi|installment|kist/)) return "emi_query";
  if (lower.match(/reward|points|redeem|cashback/)) return "rewards_query";
  if (lower.match(/close|closure|band/)) return "closure_flow";
  if (lower.match(/dispute|wrong\s*charge|unauthorized/)) return "dispute_flow";
  if (lower.match(/block|lost|stolen|unblock/)) return "card_block";
  if (lower.match(/statement|download/)) return "statement_query";
  if (lower.match(/replace|replacement|damaged/)) return "card_replacement";
  if (lower.match(/fraud|fraudulent|scam|hack/)) return "fraud_report";
  if (lower.match(/limit\s*increase|enhance\s*limit|credit\s*limit\s*badh/)) return "limit_increase";
  if (lower.match(/foreclose|prepay\s*emi|emi\s*band/)) return "emi_foreclosure";
  if (lower.match(/transaction|spend|kharch/)) return "dispute_flow";
  return "general";
}

// ─── Update session state ─────────────────────────────────────────────────────
function updateSessionState(prev, r) {
  const state = { ...prev };

  if (r.flow_cancel) {
    state.currentFlow = null;
    state.collectedSlots = {};
    state.nextSlot = null;
    return state;
  }

  if (r.flow_complete) {
    state.currentFlow = null;
    state.collectedSlots = {};
    state.nextSlot = null;
    return state;
  }

  if (r.flow_name) {
    if (!state.currentFlow) {
      state.currentFlow = r.flow_name;
      state.collectedSlots = {};
    }
    if (r.slot_filled && r.slot_value) {
      state.collectedSlots = { ...(state.collectedSlots || {}), [r.slot_filled]: r.slot_value };
    }
    state.nextSlot = r.next_slot || null;
  }

  return state;
}

// ─── Opening message ──────────────────────────────────────────────────────────
app.get("/api/opening", (req, res) => {
  const user = MOCK_USER;
  let message;

  if (user.cardStatus === "BLOCKED") {
    message = `Hi **${user.name}**! Your card is currently **blocked**. Would you like to unblock it or request a replacement?`;
  } else if (user.isOverdue) {
    message = `Hi **${user.name}**! You have an overdue payment of ₹${user.outstanding.toLocaleString("en-IN")}. Can I help with payment options?`;
  } else {
    const daysUntilDue = Math.ceil((new Date(user.dueDate) - new Date()) / 86400000);
    if (daysUntilDue <= 3 && user.outstanding > 0) {
      message = `Hi **${user.name}**! Your payment of ₹${user.minimumDue.toLocaleString("en-IN")} is due on ${user.dueDate}. How can I help you today?`;
    } else if (user.pendingDispute) {
      message = `Hi **${user.name}**! You have a pending dispute (${user.pendingDispute}). Want an update? How can I help?`;
    } else {
      message = `Hi **${user.name}**! I'm Uno, your OneCard AI assistant. How can I help you today?`;
    }
  }

  res.json({
    message,
    user: {
      name: user.name,
      last4: user.last4,
      network: user.network,
      cardStatus: user.cardStatus,
      outstanding: user.outstanding,
      dueDate: user.dueDate,
      rewardPoints: user.rewardPoints,
      availableCredit: user.availableCredit,
      creditLimit: user.creditLimit,
    },
  });
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, () => {
  console.log(`OneCard Chatbot → http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
    console.warn("⚠  No GEMINI_API_KEY — running in demo mode (rule-based fallback)");
  }
});
