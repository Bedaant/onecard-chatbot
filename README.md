# OneCard Uno AI Chatbot

A sophisticated, production-ready AI-powered customer support chatbot for the OneCard credit card platform. Built with Node.js + Express backend and vanilla JavaScript frontend, featuring progressive slot-filling dialogs, multi-tier intent classification, security hardening, and comprehensive financial compliance.

**Project**: OneCard Uno AI Assistant  
**Organization**: FPL Technologies  
**Version**: 1.0.0

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [Core Components](#core-components)
- [API Endpoints](#api-endpoints)
- [Security Features](#security-features)
- [Flows & Dialog Management](#flows--dialog-management)
- [Financial Compliance (MITC)](#financial-compliance-mitc)
- [FAQ System](#faq-system)
- [Session State Management](#session-state-management)

---

## Project Overview

OneCard Uno is a conversational AI assistant designed to handle customer support queries for credit cardholders. The system intelligently routes queries through a multi-tier classification system, manages complex dialog flows for business operations (card blocking, account closure, etc.), and maintains strict compliance with financial regulations.

**Core Capabilities:**
- Real-time customer query processing with intent classification
- Progressive slot-filling for multi-step operations
- OTP-protected critical operations (card blocking, account closure)
- Comprehensive FAQ matching and retrieval
- Regulatory compliance validation (MITC financial figures)
- Security hardening against injection attacks and prompt injection
- Session-based conversation management
- Frustration scoring and escalation detection

---

## Key Features

### 1. **Multi-Tier Intent Classification**
- **Tier 1**: Static keyword matching with hardcoded compliance responses (financial figures, fees, policies)
- **Tier 2**: Semantic similarity-based intent matching (FAQs, balance queries, general questions)
- **Tier 3**: Progressive slot-filling for business flows (card operations, account management)
- **Fallback**: Escalation detection and appropriate user messaging

### 2. **Business Flows (8 Core + 4 Additional)**
- Card blocking/unblocking with OTP verification
- Card replacement with delivery tracking
- Account closure with prerequisite validation
- EMI foreclosure, limit increase requests, fraud reporting
- Statement generation and dispute filing
- Additional flows for special scenarios

### 3. **Progressive Dialog Management**
- Slot-filling questionnaires with smart prompts
- Optional slot handling
- Flow-specific completion messages
- Deep linking to mobile app features for CTA

### 4. **Financial Compliance**
- Hardcoded MITC (Master Information to Customers) data
- Automatic validation against regulatory figures
- Protected responses for interest rates, fees, dispute windows
- RBI ombudsman and complaint portal references

### 5. **Security & Safety**
- Injection attack prevention (prompt injection, SQL, XSS patterns)
- PII masking for sensitive data (email, phone, account numbers)
- Rate limiting (30 requests/min per IP)
- Payload size limits (10KB max)
- OTP-protected workflows
- CORS restrictions and security headers
- Frustration-based escalation detection

### 6. **Session Management**
- Per-session state tracking (current flow, collected slots, OTP status)
- Turn counting and context awareness
- Frustration scoring algorithm
- Automatic cleanup on logout

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (app.js)                          │
│  • Chat UI with message rendering                              │
│  • Real-time input handling (Enter to send, Shift+Enter = new) │
│  • Typing indicator & session state management                 │
│  • Frustration bar visualization                               │
│  • Debug inspector (Ctrl+Shift+D)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP/JSON
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                       Backend (Express)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Security Middleware                                      │  │
│  │ • Rate limiting, payload validation, CORS, headers      │  │
│  │ • Injection pattern detection, PII masking              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Intent Classification (3-Tier)                           │  │
│  │ • Tier 1: MITC compliance keywords → hardcoded response │  │
│  │ • Tier 2: semantic matching → FAQ lookup                │  │
│  │ • Tier 3: flow initiation → slot-collection dialog      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dialog Engine                                             │  │
│  │ • Progressive slot-filling with validation              │  │
│  │ • Flow state transitions & pre-checks                   │  │
│  │ • Completion message generation                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Data Layer                                                │  │
│  │ • Mock user data (MOCK_USER)                            │  │
│  │ • Flow definitions (FLOWS)                              │  │
│  │ • FAQ repository (FAQS)                                 │  │
│  │ • Financial figures (MITC)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
d:/chatbot/
├── package.json                    # Project metadata & dependencies
├── README.md                       # This file
├── .env                           # Environment variables (PORT, API_KEY, etc.)
│
├── public/
│   ├── index.html                 # Chat UI markup (mobile-optimized)
│   └── app.js                     # Frontend app logic & API calls
│
├── server/
│   └── server.js                  # Express server, routing, dialog engine
│
└── prototype/
    └── data/
        ├── flows.js               # 8 core + 4 additional business flows
        ├── faqs.js                # 20 prototype FAQs (production: → DB)
        ├── mitc.js                # MITC compliance data (hardcoded)
        └── mockUser.js            # Mock user profile for testing
```

### File Responsibilities

| File | Responsibility |
|------|-----------------|
| **server/server.js** | Express server, middleware, API routes, intent classification, dialog orchestration |
| **public/app.js** | Frontend chat logic, API calls, message rendering, session state |
| **public/index.html** | UI markup, styling (mobile-first design, 420×780px card) |
| **prototype/data/flows.js** | Flow definitions with slots, prompts, options, validators, OTP flags |
| **prototype/data/faqs.js** | FAQ repository with Q&A pairs, categories, semantic tags |
| **prototype/data/mitc.js** | Financial figures, fee schedules, keyword triggers (compliance-protected) |
| **prototype/data/mockUser.js** | Mock user data for development (replaces DB in prototype) |

---

## Setup & Installation

### Prerequisites
- **Node.js** 14.x or higher
- **npm** 6.x or higher

### Installation Steps

1. **Clone/Download the project**
   ```bash
   cd d:\chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file** (in project root)
   ```env
   PORT=3000
   NODE_ENV=development
   ```

4. **Verify structure**
   ```bash
   npm list
   ```

---

## Running the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```
- Server runs on `http://localhost:3000`
- Auto-reloads on code changes (requires `nodemon`)

### Production Mode
```bash
npm start
```
- Server runs on `http://localhost:3000` or `PORT` env var

### Access the Chat
- Open browser: `http://localhost:3000`
- Chat interface loads with mock user context

### Debug Inspector
- Press `Ctrl + Shift + D` in chat to toggle debug panel
- Shows: intent, tier, confidence, route, session state, frustration score

---

## Core Components

### 1. Session State (`sessionState`)
Tracks conversation context per user:
```javascript
{
  currentFlow: "card_block" | null,         // Active flow name
  collectedSlots: { block_reason: "Lost" }, // Progressively filled
  nextSlot: "block_reason",                 // Next prompt
  frustrationScore: 0                        // Escalation trigger (0-100)
}
```

### 2. Intent Route Classes
```
Route A: TIER 1 (Compliance Keywords)
├─ Keyword match → Static MITC response
└─ Example: "What's the interest rate?" → hardcoded answer

Route B: TIER 2 (FAQ Lookup)
├─ Semantic similarity → FAQ retrieval
└─ Example: "How do I earn points?" → FAQ-003 answer

Route C: TIER 3 (Flow Initiation)
├─ Slot-filling questionnaire → Business workflow
└─ Example: "I want to close my account" → Account Closure flow

Route D: Fallback (Escalation)
└─ No match → Escalation message + frustration increment
```

### 3. Tier 1: MITC Compliance Layer
Protected financial data with hardcoded responses:
- **Keywords**: `interest`, `foreclosure`, `gst`, `late_payment`, etc.
- **Responses**: Regulatory-compliant, sourced from MITC
- **Never generated by LLM** — prevents hallucination of fees/rates

### 4. Tier 2: FAQ Matching
20 prototype FAQs with semantic search:
- Categories: Transactions & Refunds, Rewards, Billing, Cards, etc.
- Similarity matching on tags + question text
- Context-aware (user data injected selectively per intent)

### 5. Tier 3: Flow Engine
Progressive slot-filling for complex operations:

```javascript
FLOWS.card_block = {
  name: "Card Block",
  requiresOtp: true,
  slots: ["block_reason"],
  slotPrompts: { block_reason: "Lost, Stolen, or Suspicious?" },
  slotOptions: { block_reason: ["Lost", "Stolen", "Suspicious activity", "Temporary block"] },
  completion: (slots, user) => `Card ${user.last4} blocked. Replacement in 7-10 days.`,
  deepLink: "Track Replacement"
}
```

---

## API Endpoints

### `GET /api/opening`
Loads initial greeting + user context
```json
{
  "message": "Hi Rahul! 👋 I'm Uno...",
  "user": {
    "outstanding": 56500,
    "dueDate": "Apr 25, 2026",
    "rewardPoints": 2847
  }
}
```

### `POST /api/chat`
Main chat endpoint. Accepts user message, returns classified response.

**Request:**
```json
{
  "message": "Can I block my card?",
  "sessionState": {
    "currentFlow": null,
    "collectedSlots": {},
    "frustrationScore": 0
  }
}
```

**Response:**
```json
{
  "response": "I can help! Why do you need to block your card?",
  "route": "C",
  "tier": "TIER3",
  "intent": "card_block_initiate",
  "confidence": 95,
  "sessionState": {
    "currentFlow": "card_block",
    "collectedSlots": {},
    "nextSlot": "block_reason"
  },
  "requiresOtp": false
}
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `response` | Bot message to display |
| `route` | Classification route (A, B, C, D) |
| `tier` | Classification tier (TIER1, TIER2, TIER3, FALLBACK) |
| `intent` | Detected intent (e.g., "card_block", "balance_query") |
| `confidence` | Confidence score 0-100 |
| `sessionState` | Updated conversation state |
| `requiresOtp` | Whether next action needs OTP |

---

## Security Features

### 1. **Rate Limiting**
- Max 30 requests/minute per IP
- Returns `429 Too Many Requests` if exceeded

### 2. **Payload Validation**
- Max payload: 10 KB
- Prevents large injection attacks

### 3. **Injection Attack Prevention**
Blocks patterns like:
```
"ignore previous instructions"
"system override"
"jailbreak"
"<|im_start|>"
"pretend you are"
```

### 4. **PII Masking**
Automatically masks sensitive data in logs:
```
Email: user@example.com → us**@exa***.com
Phone: +919876543210 → +91987654**10
Account: 1234567890 → 123456****
```

### 5. **Security Headers**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### 6. **OTP-Protected Flows**
Critical operations require OTP:
- card_block, card_unblock, card_replacement
- account_closure, emi_foreclosure, limit_increase, fraud_report

---

## Flows & Dialog Management

### 8 Core Flows

| Flow | Requires OTP | Slots | Key Action |
|------|-------------|-------|-----------|
| **card_block** | ✓ | block_reason | Block card with reason tracking |
| **card_unblock** | ✓ | None | Unblock card immediately |
| **card_replacement** | ✓ | reason | Request replacement card |
| **account_closure** | ✓ | confirm | Close account (prerequisites check) |
| **emi_foreclosure** | ✓ | emi_validate | Early EMI payment |
| **limit_increase** | ✓ | amount | Request credit limit increase |
| **fraud_report** | ✓ | txn_details | Report fraudulent transaction |
| **dispute_filing** | ✓ | txn_id | File dispute on transaction |

### 4 Additional Flows

| Flow | Requires OTP | Slots | Key Action |
|------|-------------|-------|-----------|
| **reward_redemption** | ✗ | points, redemption_type | Redeem reward points |
| **statement_download** | ✗ | month, year | Download statement |
| **privacy_settings** | ✗ | preference_type | Update preferences |
| **support_escalation** | ✗ | issue_category | Escalate to human agent |

### Slot-Filling Example: Card Block Flow

```
User: "I want to block my card"
→ Intent detected: card_block (Tier 3, route C)
→ Flow initiated, OTP required flag set
→ Bot asks: "Why do you need to block? Lost, Stolen, Suspicious, or Temporary?"
→ User: "Stolen"
→ Slot collected: block_reason = "Stolen"
→ Completion message sent with tracking link
→ Card blocked, SMS confirmation queued
```

---

## Financial Compliance (MITC)

Master Information to Customers (MITC) data is **hardcoded** and protected:

### Key Figures
```javascript
{
  interest_rate_monthly: "3.75% per month",
  interest_rate_annual: "45% per annum",
  interest_free_period: "Up to 48 days",
  emi_processing_fee: "1% (min ₹99)",
  dispute_filing_window: "30 days from statement date",
  rbi_ombudsman: "14448",
  rbi_complaint_portal: "cms.rbi.org.in"
  // ... 10+ more regulatory figures
}
```

### Tier 1 Protection
When user asks about financial figures, the response is **always** fetched from MITC, never generated by LLM:

```
User: "What's the foreclosure fee?"
→ Keyword matched: "foreclosure"
→ Response: Static MITC data
→ Source citation: "(Source: MITC — Foreclosure Fee)"
```

This prevents hallucination and ensures regulatory compliance.

---

## FAQ System

### FAQ Repository (25 Prototype FAQs)

Complete customer knowledge base covering all major categories:

#### **Transactions & Refunds (4 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-001 | How long does a refund take to credit? | Refunds typically take 5-7 working days to reflect in your available credit limit after the merchant processes it. For cash refunds to your bank account, it takes 7-10 working days. |
| FAQ-002 | Why is there an unfamiliar transaction on my card? | If you see an unrecognized transaction, first check if it could be a subscription, family member's purchase, or a merchant with a different billing name. If it's still unfamiliar, you can file a dispute within 30 days of the statement date. |
| FAQ-022 | What is a dispute and how does resolution work? | A dispute is a formal challenge against a transaction you didn't authorize, didn't receive, or was charged incorrectly. After filing: (1) provisional credit within 10 days if eligible, (2) merchant investigation, (3) final resolution within **30 days** (RBI mandate). |
| FAQ-025 | How do I avoid interest charges? | Pay the **full outstanding amount** by the due date (25th of each month) — this gives you up to 48 days interest-free. Paying only the minimum due means interest (3.75%/month) accrues on the entire unpaid balance. |

#### **Rewards & Offers (3 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-003 | How do I earn reward points? | You earn 1 reward point per ₹50 spent on most transactions. Select categories like dining, entertainment, or partner merchants may earn 5X points. Check the OneCard app for current 5X categories. |
| FAQ-004 | When do reward points expire? | Reward points are valid for 2 years from the date of earning. You'll receive a reminder before expiry. Points forfeited on account closure cannot be reinstated. |
| FAQ-005 | How do I redeem reward points? | You can redeem points through the OneCard app under Rewards → Redeem. Minimum redemption is 500 points (₹125 value). Points can be redeemed against your statement balance or for gift vouchers. |

#### **Bill & Repayment (5 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-006 | How do I repay my OneCard bill? | You can pay through: (1) OneCard app → Pay Bill, (2) NEFT/IMPS to virtual account, (3) UPI using card's VPA, or (4) net banking. Pay before due date (25th) to avoid interest. |
| FAQ-006B | What happens if I only pay the minimum due? | Paying only minimum due keeps account in good standing, but interest at 3.75% per month (45% p.a.) accrues on unpaid balance. Paying full amount avoids interest entirely. |
| FAQ-007 | How do I set up autopay? | Set up autopay in OneCard app under Settings → Autopay. Choose to autopay minimum due, full outstanding, or fixed amount. Setup takes up to 2 billing cycles to activate. |
| FAQ-008 | What is the credit-free period? | OneCard offers up to **48 days** interest-free credit depending on when in the billing cycle you make a purchase. Purchases at start of cycle get full 48 days; near-end purchases get fewer days. |
| FAQ-020 | What is the billing cycle? | Your statement is generated on **3rd of every month**. Payment due date is **25th of the month**. This gives you ~22 days to pay. Transactions after 3rd appear in next statement. |

#### **Card Related (8 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-009 | How long does card delivery take? | New cards are delivered within 7-10 working days of approval. You'll receive tracking details via SMS once dispatched. Replacement cards also take 7-10 working days. |
| FAQ-010 | How do I activate my new card? | Activate in OneCard app under Cards → Activate Card, or do first ATM transaction with welcome PIN sent to registered mobile. Online activation available 24/7. |
| FAQ-021 | What happens when I block my card? | Blocking freezes all new transactions instantly (online, in-store, contactless). Recurring charges & pending refunds continue. Temporary block can be unblocked anytime from app. Permanent block triggers replacement in 7-10 days. |
| FAQ-023 | How do I retrieve or reset my PIN? | Go to app → Cards → **Change PIN**. OTP verification required. You'll receive secure link to set new PIN directly (not via SMS). Works even if you forgot current PIN. |
| FAQ-024 | What is the difference between credit limit and available credit? | **Credit limit** is max you can spend (e.g., ₹2,00,000). **Available credit** is remaining after subtracting outstanding and pending transactions. Example: ₹2,00,000 − ₹56,500 = ₹1,43,500 available. |
| FAQ-013 | How do I add a family member's card? | Add up to 3 add-on cards in OneCard app under Card → Add-on Card. Primary cardholder is responsible for all add-on card spends. Add-on cards share primary credit limit. |
| FAQ-016 | How do I get lounge access? | OneCard provides complimentary airport lounge access based on spend tier. Check eligibility under Benefits → Lounge Access. Present card at lounge — no separate membership needed. |
| FAQ-019 | How secure is my OneCard? | Uses chip-and-PIN, 3D Secure for online transactions, real-time alerts. Instantly freeze/unfreeze card in app. Can enable/disable international transactions per trip. |

#### **EMI (3 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-011 | What is EMI and how does it work on OneCard? | EMI lets you split large purchases into fixed monthly payments. Convert eligible transactions (above ₹1,500) into 3, 6, 9, or 12 monthly instalments. EMI amount added to monthly bill instead of full charge. |
| FAQ-011B | Can I convert any transaction to EMI? | Transactions above ₹1,500 are eligible. Convert within 30 days of transaction. Tenures: 3, 6, 9, 12 months. Processing fee: **1% of amount (min ₹99)**. |
| FAQ-012 | What happens to my EMI if I close my account? | All active EMIs must be foreclosed before account closure. Foreclosure fee: **3% of outstanding principal (min ₹99)** per EMI. Principal plus fee added to final statement. |

#### **Account & KYC (2 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-014 | How do I update my address? | Update in OneCard app under Profile → Address. OTP verification required. Changes reflect in 2-3 working days. New card (if issued) sent to updated address. |
| FAQ-015 | How do I update my PAN or Aadhaar? | KYC document updates require fresh submission under Profile → KYC Update. Upload clear photo of document. Processing takes 2-4 working days. |

#### **Offers & Eligibility (2 FAQs)**
| ID | Question | Answer |
|----|----------|--------|
| FAQ-017 | Is there a credit limit increase option? | Credit limit increases reviewed every 6 months based on repayment history and credit score. Request review under Card → Credit Limit. Approval at FPL's discretion. |
| FAQ-018 | What is the customer care number? | OneCard customer care: **1800-XXX-XXXX** (toll-free, 24/7). RBI complaints: **14448**. Grievance portal: cms.rbi.org.in. Chat support 24/7 in app. |

### FAQ Structure (JavaScript)
```javascript
{
  id: "FAQ-006",
  category: "Bill & Repayment",
  question: "How do I repay my bill?",
  answer: "Through app, NEFT/IMPS, UPI, or net banking...",
  tags: ["repay", "payment", "bill pay", "bhugtan"]  // Multilingual support
}
```

### Matching Algorithm
1. **Tokenize** user message into keywords
2. **Calculate** cosine similarity with FAQ question + tags
3. **Return** top match if confidence > threshold
4. **Inject** selective user context (balance, EMIs, etc.) when relevant
5. **Fallback** to Tier 3 flows if no match found

---

## Session State Management

### Per-User Session Tracking
```javascript
sessionState = {
  currentFlow: string | null,           // Active flow name
  collectedSlots: { [key]: value },     // Filled values
  nextSlot: string | null,              // Next prompt
  frustrationScore: number              // 0–100 escalation metric
}
```

### Frustration Scoring
Incremented on:
- **Fallback responses** (+10): No match found, escalation offered
- **Repeated intent re-enters** (+15): User asks same thing multiple times
- **Flow abandonment** (+5): User switches flows without completing

**Escalation trigger**: Score ≥ 75
- Bot switches to empathetic messages
- Offers human agent escalation

### Turn Counting
```javascript
turnCount++;   // Incremented each user message
waitingForOtp; // Flag for OTP-pending flows
```

---

## Frontend Features

### Chat UI (Mobile-Optimized)
- **Dimensions**: 420×780px (mobile phone mockup)
- **Header**: Uno avatar, online status, last-seen indicator
- **Message area**: Scrollable, left/right alignment
- **Input**: Auto-expanding textarea with Enter-to-send
- **Stats bar**: Outstanding balance, due date, reward points

### Interactive Elements
- Message bubbles with timestamps
- Bot typing indicator (animated dots)
- Message options (quick reply buttons from Tier 3 slots)
- Frustration bar visualization
- Debug inspector (Ctrl+Shift+D)

### Input Handling
```javascript
// Enter = Send message
// Shift + Enter = New line in textarea
// Auto-grow textarea height (max 80px)
// Auto-scroll to latest message
// Disable input while waiting for response
```

---

## Development Notes

### Mock Data
- **User context**: `prototype/data/mockUser.js` (replaces DB calls)
- **Flows**: `prototype/data/flows.js` (extends with real endpoints)
- **FAQs**: `prototype/data/faqs.js` → migrate to database
- **MITC**: `prototype/data/mitc.js` (hardcoded, production-ready)

### Production Migration Steps
1. Database: Replace `FLOWS`, `FAQS` with DB queries
2. Authentication: Add JWT tokens, user identification
3. OTP Service: Integrate Twilio/AWS SNS for real OTP delivery
4. Logging: Replace console.log with structured logging (Winston/bunyan)
5. Monitoring: Add APM (DataDog, New Relic, Sentry)
6. Compliance: Full audit trail for regulatory audits

### Testing
- Manual: Use debug inspector to verify intent classification
- Unit: Test flow slot-filling logic, MITC validation
- Integration: End-to-end with mock data
- Load: Simulate 100+ concurrent users (rate limiting)

---

## Troubleshooting

### Chat not connecting
1. Check server is running: `npm run dev`
2. Port 3000 available: `netstat -no | findstr :3000`
3. Check browser console for errors (F12)
4. CORS issue? Check Express `cors()` config

### Intent misclassified
1. Open debug inspector (Ctrl+Shift+D)
2. Check `intent`, `tier`, `confidence` values
3. If Tier 1/2 but should be Tier 3: Add keywords to flow triggers
4. If Tier 3 but no slots collected: Check flow definition

### Session state lost
1. Accidentally cleared browser local storage
2. Server restarted (in-memory state cleared)
3. Session timeout (implement in production)

---

## License & Credits

**Project**: OneCard Uno AI Chatbot  
**Organization**: FPL Technologies  
**Built with**: Node.js, Express.js, Vanilla JavaScript  
**Prototype Status**: Ready for development iteration  

---

## Contact & Support

For questions or issues, contact the FPL Technologies development team.

---

**Last Updated**: April 2026  
**Version**: 1.0.0 (Prototype)
