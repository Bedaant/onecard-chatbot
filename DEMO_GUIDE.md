# OneCard Chatbot — Demo Showcase Guide

**Server:** http://localhost:3009  
**Inspector:** Ctrl+Shift+D (shows tier, intent_type, flow_name, confidence, compliance_citation)

---

## What to Show (Ordered Script)

Work through these sections in order. Each one demonstrates a distinct architectural decision.

---

### 1. Pure FAQ — No Flow Triggered

**What it proves:** Informational questions answer from the FAQ corpus without starting any flow.

| Type this | What you'll see |
|-----------|----------------|
| `EMI kya hota hai` | Explanation of EMI — no flow_name, tier=T3_LLM or T2_DEMO |
| `interest rate kya hai` | 3.75%/month — tier=T1_STATIC (zero-LLM path, fastest) |
| `block karne se kya hota hai` | Explains blocking — no flow_name |
| `repayment kaise karte hain` | Payment instructions — no flow_name |
| `dispute kya hota hai` | Dispute process explained — compliance_citation visible |

Open the inspector (Ctrl+Shift+D) and point to:
- `intent_type: "informational"` — Gemini's own classification
- `flow_name: null` — system decided NOT to start a flow
- `tier: T1_STATIC` for interest rate — bypassed LLM entirely

---

### 2. Pure Flow — Slot by Slot

**What it proves:** Action requests start flows, collect one slot at a time, complete with a confirmation.

**Card Block (simplest, 1 slot):**
```
card block karo
→ bot asks: Lost / Stolen / Suspicious activity / Temporary block
Lost
→ bot confirms: Card has been blocked ✓
```

**Dispute Filing (2 slots):**
```
dispute file karna hai
→ bot asks: which transaction?
Swiggy 450 Apr 12
→ bot asks: what's the reason?
Wrong amount
→ bot confirms: DIS-XXXX filed, 30-day SLA
```

**Account Closure (exact-match confirm):**
```
account close karna hai
→ bot shows prerequisites (outstanding balance, EMI, reward points)
→ bot asks for exact confirmation phrase
yes close it
→ bot rejects — shows "type CLOSE MY ACCOUNT"
CLOSE MY ACCOUNT
→ CLO-XXXX, 7 working days ✓
```

Point to in inspector: `flow_name`, `next_slot`, `flow_complete: true`

---

### 3. FAQ vs Flow — The Hard Decision

**What it proves:** Same words can be a question or an action. The system handles both correctly.

**Type these back-to-back:**

```
EMI kya hota hai        → FAQ answer, no flow (informational)
EMI convert karna hai   → starts emi_conversion flow (transactional)

block karne se kya hota hai   → FAQ answer, no flow
card block karo               → starts card_block flow

dispute kya hota hai         → FAQ answer, no flow
dispute file karna hai       → starts dispute_filing flow
```

**The ambiguous case (Route C):**
```
block
→ "Did you want to block your card or learn how blocking works?"
```
2 options appear as buttons. This is Route C — system refuses to guess.

**The tiebreak case:**
```
mujhe pata karna hai ki EMI kya hai
→ FAQ answer (main verb = "pata karna" = find out → informational)

mujhe EMI convert karna hai
→ starts flow (main verb = "convert karna" = do it → transactional)
```

---

### 4. Mid-Flow Interruption

**What it proves:** Questions asked during a flow get answered inline — the flow is never lost.

Start card_block flow:
```
card block karo
→ bot asks: what's the reason?
```

Now ask a completely different question:
```
repayment kaise karu
→ bot answers the repayment question in 1 sentence, then: "Back to Card Block — [reason question]"
```

Try more interruptions from the same mid-flow state:
```
EMI kya hota hai     → answered + flow resumed
interest rate kya hai → answered + flow resumed
reward points kitne hain → answered + flow resumed
```

Point to: `flow_name` stays `"card_block"` throughout. `next_slot` never cleared.

**Why this works:** The system uses FAQ scoring (tag match + word overlap) to find the most relevant answer for any question. Adding a new FAQ to faqs.js automatically works mid-flow — zero code changes needed.

---

### 5. Mid-Flow Cancel

```
card block karo
→ bot asks reason

cancel
→ "Request cancelled. How else can I help?"
```

Inspector: `flow_cancel: true`, `flow_name: null`

---

### 6. T1 Static — Zero-LLM Path

**What it proves:** Fee/rate queries never touch the LLM. Instant, zero-hallucination.

```
interest rate kya hai    → 3.75%/month (tier: T1_STATIC)
forex markup kitna hai   → 1% (tier: T1_STATIC)
EMI processing fee kya hai → 1% min ₹99 (tier: T1_STATIC)
```

Then show that action words bypass T1:
```
emi foreclose karna hai  → starts flow (NOT T1, even though "foreclose" exists in MITC)
```

T1 only fires for information queries about fees. Action intent always routes to the flow engine.

---

### 7. Multi-Intent (Bonus)

```
card block karo aur interest rate bhi batao
→ bot starts card_block flow AND includes the interest rate answer in the same response
```

Two intents resolved in one turn.

---

### 8. Frustration + Escalation

```
talk to agent
→ immediate warm handoff, no escalation threshold needed
```

```
ye bot bekar hai kuch kaam ka nahi
→ frustration detected, auto-escalation offer
```

---

## Architecture Explanation (for the technical audience)

### The 6-Gate Decision Pipeline

Every message passes through these gates in strict order:

```
Gate 1: Active Flow?
        → Yes: fill next slot (or handle interruption)
        → No: continue

Gate 2: Instant Escalation / Frustration?
        → Yes: warm handoff (no LLM call)
        → No: continue

Gate 3: T1 Static Match?
        → Yes: return fee/rate from MITC table (no LLM call)
        → No: continue

Gate 4: Route C Ambiguity?
        → 1-2 word message + ambiguous term: present 2 clarify options (no LLM call)
        → No: continue

Gate 5: Gemini LLM (primary intelligence)
        → Returns: route, intent_type, flow_name, slot fills, response

Gate 6: Server-Side Overrides (sanity + safety)
        → FAQ override (informational + score ≥ 4 → clear flow_name)
        → Slot validation (exact-match rules, address PIN check)
        → Multi-intent injection (aur/bhi detected → append FAQ snippet)
        → 0-slot flow completion (bill_payment, pin_change, etc.)
        → Mid-flow context restore (if LLM dropped flow_name on a question)

T2 Fallback: Rule-based demo router (Gemini unavailable/rate-limited)
```

### The Core Problem — FAQ vs Flow

The hardest decision: same surface text can be a question or an action.

**Wrong approach:** keyword matching — "karna" → transactional, "kya" → informational. Fails on mixed sentences.

**The solution — 3-layer architecture:**

1. **Gemini's `intent_type` field** (primary): Gemini reads the full sentence semantically and returns `"informational" | "transactional" | "ambiguous"`. It reads the *main verb of the main clause*, not individual words.

2. **`resolveIntentType()`** (server fallback): When Gemini is unavailable, a deterministic tiebreak:
   - Question words only → `"informational"`
   - Action verbs only → `"transactional"`
   - Both present → check for *find-out verbs* (`pata karna`, `jaanna`, `samajhna`, `dekhna`) → if found, `"informational"`; otherwise `"transactional"`

3. **`scoreFAQs()` safety net**: If intent is informational AND FAQ score ≥ 4 AND a flow was started → override, clear flow_name. Guards against Gemini misclassification.

### Mid-Flow Interruption Architecture

**Old approach:** hardcoded keyword→answer pairs. Added "repayment" → answers repayment. Misses everything else.

**New approach:** `scoreFAQs(text)` on the interrupting question. Returns the best-matching FAQ above threshold (score ≥ 3). The top-2 sentences of that answer become the inline response. Any FAQ added to faqs.js is automatically available mid-flow. Zero maintenance surface.

---

## Inspector Panel Reference (Ctrl+Shift+D)

| Field | What it shows |
|-------|--------------|
| `tier` | T1_STATIC / T2_AMBIGUITY / T3_LLM / T2_DEMO / FALLBACK |
| `intent_type` | informational / transactional / ambiguous (Gemini's read) |
| `flow_name` | Active flow or null |
| `next_slot` | What the bot is waiting for |
| `flow_complete` | Whether the flow was completed this turn |
| `flow_cancel` | Whether the user cancelled |
| `confidence` | Gemini's confidence 0–100 |
| `compliance_citation` | FAQ-ID or MITC field referenced |
| `route` | A=direct / B=confirm / C=clarify / D=escalate / E=out-of-scope |
| `frustrationScore` | 0–1, cumulative |

---

## Coverage Summary

- **18 flows** covering card management, payments, disputes, fraud, account ops, preferences
- **27 FAQs** covering product concepts, fees, policies, account info
- **Languages:** English, Hindi, Hinglish — auto-detected per message
- **Security:** PII redaction, injection scanning, rate limiting (500/min test, 30/min prod)
- **Test suite:** 73 tests, all passing (`.\test_flows.ps1` from PowerShell)
