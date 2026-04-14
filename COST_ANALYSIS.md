# OneCard Chatbot — Cost Analysis

Model: **Gemini 2.5 Flash Lite**  
Pricing (as of April 2026): $0.10 / 1M input tokens · $0.40 / 1M output tokens

---

## Token Budget Per Request

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt (base) | ~1,800 | MITC table + brand rules + flow list + JSON schema |
| FAQ context (3 FAQs injected) | ~350 | 3 × ~120 tokens avg |
| User account context | ~120 | Selective fields per intent |
| Session state | ~40 | flowState + frustrationScore |
| User message | ~20 | Typical chat message |
| **Total input** | **~2,330** | |
| LLM response (JSON) | ~150 | Max 800 tokens, avg ~150 |

**Per-call cost:**  
`2,330 × $0.10/1M = $0.000233 input`  
`150 × $0.40/1M = $0.000060 output`  
**Total: ~$0.000293 per LLM call** (~₹0.025)

---

## T1 / T2 Bypass Savings

Not every message reaches Gemini. The gate pipeline short-circuits early:

| Gate | Bypass rate | Examples |
|------|------------|---------|
| T1_STATIC (fee/rate lookup) | ~15% of messages | "interest rate kya hai", "forex markup" |
| T2_AMBIGUITY (Route C) | ~5% | 1-2 word ambiguous terms |
| Frustration/Escalation | ~3% | "talk to agent", frustration keywords |
| Mid-flow slot fill (demo router only) | ~8% | Answering a slot — no LLM if demo mode |

**Effective LLM call rate: ~75% of messages**  
(25% of messages never reach Gemini)

---

## DAU Scenarios

### Assumptions
- 8 messages/session average (industry benchmark for support bots)
- LLM call rate: 75% (25% bypass)
- 30 days/month

| Scenario | DAU | Daily sessions | Daily messages | Daily LLM calls | Monthly LLM calls | Monthly cost (USD) | Monthly cost (INR) |
|----------|-----|---------------|---------------|----------------|------------------|-------------------|-------------------|
| Early pilot | 1,000 | 1,000 | 8,000 | 6,000 | 180,000 | **$52.7** | **₹4,400** |
| Growth | 10,000 | 10,000 | 80,000 | 60,000 | 1,800,000 | **$527** | **₹44,000** |
| Mid-scale | 50,000 | 50,000 | 400,000 | 300,000 | 9,000,000 | **$2,637** | **₹2.2L** |
| Large | 1,00,000 | 1,00,000 | 800,000 | 600,000 | 18,000,000 | **$5,274** | **₹4.4L** |
| 15L users (1% active) | 15,00,000 | 15,000 | 120,000 | 90,000 | 2,700,000 | **$791** | **₹66,000** |
| 15L users (5% active) | 15,00,000 | 75,000 | 600,000 | 450,000 | 13,500,000 | **$3,955** | **₹3.3L** |

> DAU numbers above assume 1 session per active user per day.  
> INR conversion at ₹83.5 / USD.

### DAU 10k — Detailed Breakdown

```
10,000 active users/day
× 8 messages/session
= 80,000 messages/day

80,000 × 75% LLM rate
= 60,000 Gemini calls/day

60,000 × $0.000293/call
= $17.58/day

$17.58 × 30 days
= $527/month (~₹44,000/month)
```

**Infrastructure (additional):**

| Component | Monthly cost (USD) | Notes |
|-----------|-------------------|-------|
| Node.js server (2 vCPU, 4GB RAM) | $20–40 | AWS t3.medium / GCP e2-medium |
| Redis cache (optional, T0 layer) | $15–30 | ElastiCache t3.micro |
| CDN / static assets | $5–10 | CloudFront or similar |
| Logging / monitoring | $10–20 | CloudWatch or Datadog basic |
| **Total infra** | **$50–100** | |

**Total monthly at DAU 10k: ~$577–627 (~₹48k–52k)**

---

## Cost per Resolved Query

At DAU 10k:
- ~80,000 messages/day = ~10,000 sessions/day
- Assuming ~85% resolution rate (bot handles without human escalation)
- 8,500 sessions resolved per day

Cost per resolved session: `$17.58 / 8,500 = $0.002/session` (~₹0.17)

This is 50–100x cheaper than a human agent session (~₹150–300/session).

---

## Optimization Levers

### 1. System Prompt Compression (highest ROI)

Current system prompt: ~1,800 tokens. Can be reduced to ~900–1,100 tokens by:
- Removing verbose examples (keep just signal/examples for `intent_type`, cut the rest)
- Compressing the FLOWS list (use 1-line format, not multi-line)
- Moving MITC table to a compressed key-value format

**Savings: 35–40% on input tokens → ~₹15k/month at DAU 10k**

### 2. T0 Intent Cache (Redis)

Cache Gemini responses for high-frequency identical messages:
- "interest rate kya hai", "EMI kya hai", "reward points kitne hain" — same question asked thousands of times/day
- Cache key: normalized message text
- TTL: 24 hours for static content, 5 minutes for account-dependent responses

**Expected cache hit rate: 20–30%**  
**Savings: additional ~₹9k–13k/month at DAU 10k**

### 3. Tiered Model Strategy

| Request type | Suggested model | Cost vs current |
|-------------|----------------|----------------|
| FAQ/info responses (no slot fill) | Gemini 2.0 Flash Lite or Haiku | -60% |
| Slot-filling (active flows) | Gemini 2.5 Flash Lite (current) | baseline |
| Ambiguous / escalation | Gemini 2.5 Flash Lite (current) | baseline |

Route ~40% of traffic (pure informational) to a cheaper model.  
**Savings: ~₹17k/month at DAU 10k**

### 4. Prompt Caching

Gemini 2.5 Flash Lite supports context caching. The system prompt (1,800 tokens) is identical for every request — cache it server-side.  
Cached token cost: $0.025/1M (vs $0.10/1M standard)  
**Savings: ~₹33k/month at DAU 10k** (75% reduction on input cost)

> This is the single biggest lever. Implement it first.

---

## Savings Summary at DAU 10k

| Optimization | Monthly savings (INR) | Complexity |
|-------------|----------------------|-----------|
| Prompt caching | ~₹33,000 | Low (API flag) |
| System prompt compression | ~₹15,000 | Medium |
| T0 Redis cache | ~₹12,000 | Medium |
| Tiered model routing | ~₹17,000 | High |
| **Combined** | **~₹77,000** | |

**Baseline cost: ₹44,000/month → Optimized: ~₹12,000–15,000/month at DAU 10k**

---

## Scaling Projection

| DAU | Baseline monthly (INR) | With prompt caching (INR) | Fully optimized (INR) |
|-----|----------------------|--------------------------|----------------------|
| 1,000 | ₹4,400 | ₹1,100 | ₹700 |
| 10,000 | ₹44,000 | ₹11,000 | ₹7,000 |
| 50,000 | ₹2.2L | ₹55,000 | ₹35,000 |
| 1,00,000 | ₹4.4L | ₹1.1L | ₹70,000 |
| 15L total (5% DAU) | ₹3.3L | ₹82,000 | ₹52,000 |

At scale, LLM cost becomes negligible relative to human agent headcount saved.  
1 human agent handles ~100–150 sessions/day at ₹25,000–40,000/month.  
Bot at DAU 10k handles 8,500 sessions/day — equivalent of 56–85 agents.

---

## When to Move Off Free Tier

Gemini 2.5 Flash Lite free tier limits: 15 req/min, 1,500 req/day, 1M tokens/day.

- Free tier supports: **DAU ~150–200 in test/pilot**
- First paid threshold: DAU > 200 (need to upgrade to pay-as-you-go)
- Paid starts at: ~$0 minimum (true PAYG, no monthly floor)

---

## Notes

- All costs exclude GST (18% applicable on Google Cloud India billing)
- Gemini pricing subject to change — verify at ai.google.dev/pricing
- Token counts estimated from actual prompt inspection; will vary ±15% by query type
- "Sessions" assumed = 1 conversation per user per day; power users may trigger 2–3x
