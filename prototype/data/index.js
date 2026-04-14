/**
 * Data Layer Index
 * Centralized exports for all chatbot data:
 * - Business flows (slot-filling dialogs)
 * - FAQs (customer knowledge base)
 * - MITC compliance data (financial figures)
 * - Mock user data (for development/testing)
 *
 * Usage in server.js:
 *   const { FLOWS, FAQS, MITC, MOCK_USER } = require('./prototype/data');
 */

const { FLOWS, FLOWS_REQUIRING_OTP, requiresOtp } = require('./flows');
const { FAQS } = require('./faqs');
const { MITC, TIER1_KEYWORDS, TIER1_RESPONSES } = require('./mitc');
const { MOCK_USER, INTENT_CONTEXT_MAP } = require('./mockUser');

module.exports = {
  // ─── Flows ───────────────────────────────────────────────────────────────
  // Business workflows with progressive slot-filling
  FLOWS,
  FLOWS_REQUIRING_OTP,
  requiresOtp,

  // ─── FAQs ────────────────────────────────────────────────────────────────
  // Customer knowledge base (25+ FAQs across categories)
  FAQS,

  // ─── MITC Compliance ─────────────────────────────────────────────────────
  // Hardcoded regulatory data (interest rates, fees, dispute windows)
  MITC,
  TIER1_KEYWORDS,
  TIER1_RESPONSES,

  // ─── Mock User ───────────────────────────────────────────────────────────
  // Development/testing user profile
  MOCK_USER,
  INTENT_CONTEXT_MAP,

  // ─── Metadata ────────────────────────────────────────────────────────────
  metadata: {
    version: "1.0.0",
    lastUpdated: "April 2026",
    flows: {
      total: Object.keys(FLOWS).length,
      requireOtp: FLOWS_REQUIRING_OTP.length,
      requiresOtp: FLOWS_REQUIRING_OTP,
    },
    faqs: {
      total: FAQS.length,
      categories: [...new Set(FAQS.map(faq => faq.category))],
    },
    mitcKeywords: {
      total: Object.keys(TIER1_KEYWORDS).length,
      categories: Object.keys(TIER1_KEYWORDS),
    },
  },
};
