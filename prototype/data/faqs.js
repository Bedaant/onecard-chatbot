// 20 prototype FAQs — covers key categories
const FAQS = [
  // Transactions & Refunds
  {
    id: "FAQ-001",
    category: "Transactions & Refunds",
    question: "How long does a refund take to credit?",
    answer: "Refunds typically take 5-7 working days to reflect in your available credit limit after the merchant processes it. For cash refunds to your bank account, it takes 7-10 working days.",
    tags: ["refund", "credit", "merchant", "reversal"],
  },
  {
    id: "FAQ-002",
    category: "Transactions & Refunds",
    question: "Why is there an unfamiliar transaction on my card?",
    answer: "If you see an unrecognized transaction, first check if it could be a subscription, family member's purchase, or a merchant with a different billing name. If it's still unfamiliar, you can file a dispute within 30 days of the statement date.",
    tags: ["unknown transaction", "unfamiliar", "fraud", "dispute"],
  },

  // Rewards & Offers
  {
    id: "FAQ-003",
    category: "Rewards & Offers",
    question: "How do I earn reward points?",
    answer: "You earn 1 reward point per ₹50 spent on most transactions. Select categories like dining, entertainment, or partner merchants may earn 5X points. Check the OneCard app for current 5X categories.",
    tags: ["earn points", "reward points", "5x", "cashback"],
  },
  {
    id: "FAQ-004",
    category: "Rewards & Offers",
    question: "When do reward points expire?",
    answer: "Reward points are valid for 2 years from the date of earning. You'll receive a reminder before expiry. Points forfeited on account closure cannot be reinstated.",
    tags: ["points expiry", "expire", "validity"],
  },
  {
    id: "FAQ-005",
    category: "Rewards & Offers",
    question: "How do I redeem reward points?",
    answer: "You can redeem points through the OneCard app under Rewards → Redeem. Minimum redemption is 500 points (₹125 value). Points can be redeemed against your statement balance or for gift vouchers.",
    tags: ["redeem", "redemption", "gift voucher", "statement credit"],
  },

  // Bill & Repayment
  {
    id: "FAQ-006",
    category: "Bill & Repayment",
    question: "How do I repay my OneCard bill?",
    answer: "You can pay your bill through: (1) OneCard app → Pay Bill, (2) NEFT/IMPS to your card's virtual account number, (3) UPI using your card's VPA, or (4) net banking. Pay before the due date (25th of each month) to avoid interest. Full payment avoids interest; minimum due avoids late fees.",
    tags: ["repay", "repayment", "payment kaise", "bill pay", "kaise bhare", "kaise kare", "bhugtan", "pay kaise"],
  },
  {
    id: "FAQ-006B",
    category: "Bill & Repayment",
    question: "What happens if I only pay the minimum due?",
    answer: "Paying only the minimum due keeps your account in good standing, but interest at 3.75% per month (45% p.a.) accrues on the unpaid balance from the payment due date. Paying the full amount avoids interest entirely.",
    tags: ["minimum due", "interest", "partial payment"],
  },
  {
    id: "FAQ-007",
    category: "Bill & Repayment",
    question: "How do I set up autopay?",
    answer: "Set up autopay in the OneCard app under Settings → Autopay. You can choose to autopay the minimum due, full outstanding, or a fixed amount. Setup takes up to 2 billing cycles to activate.",
    tags: ["autopay", "auto debit", "standing instruction", "NACH"],
  },
  {
    id: "FAQ-008",
    category: "Bill & Repayment",
    question: "What is the credit-free period?",
    answer: "OneCard offers up to 48 days interest-free credit. This depends on when in the billing cycle you make a purchase. Transactions at the start of the cycle get the full 48 days; those near the end get fewer days.",
    tags: ["interest free", "grace period", "credit period", "48 days"],
  },

  // Card Related
  {
    id: "FAQ-009",
    category: "Card Related",
    question: "How long does card delivery take?",
    answer: "New cards are delivered within 7-10 working days of approval. You'll receive tracking details via SMS once dispatched. Replacement cards also take 7-10 working days.",
    tags: ["card delivery", "new card", "dispatch", "tracking"],
  },
  {
    id: "FAQ-010",
    category: "Card Related",
    question: "How do I activate my new card?",
    answer: "Activate your card in the OneCard app under Cards → Activate Card, or do your first ATM transaction with the welcome PIN sent to your registered mobile. Online activation is available 24/7.",
    tags: ["activate", "activation", "new card", "first use"],
  },

  // EMI
  {
    id: "FAQ-011",
    category: "EMI",
    question: "What is EMI and how does it work on OneCard?",
    answer: "EMI (Equated Monthly Instalment) lets you split a large purchase into smaller fixed monthly payments. On OneCard, you can convert any eligible transaction (above ₹1,500) into 3, 6, 9, or 12 monthly instalments. The EMI amount is added to your monthly bill instead of the full charge.",
    tags: ["emi", "emi kya", "what is emi", "installment", "kist", "monthly", "split"],
  },
  {
    id: "FAQ-011B",
    category: "EMI",
    question: "Can I convert any transaction to EMI?",
    answer: "Transactions above ₹1,500 are eligible for EMI conversion. You can convert within 30 days of the transaction. Tenures available: 3, 6, 9, and 12 months. Processing fee: 1% of amount (min ₹99).",
    tags: ["emi conversion", "convert to emi", "eligible", "tenure"],
  },
  {
    id: "FAQ-012",
    category: "EMI",
    question: "What happens to my EMI if I close my account?",
    answer: "All active EMIs must be foreclosed before account closure. Foreclosure fee: 3% of outstanding principal (min ₹99) per EMI. The remaining principal plus fee will be added to your final statement.",
    tags: ["emi closure", "account closure", "foreclose", "outstanding"],
  },

  // Family / Addon Card
  {
    id: "FAQ-013",
    category: "Family / Addon Card",
    question: "How do I add a family member's card?",
    answer: "Add up to 3 add-on cards for family members in the OneCard app under Card → Add-on Card. The primary cardholder is responsible for all add-on card spends. Add-on cards share the primary credit limit.",
    tags: ["family card", "add-on", "supplementary", "add member"],
  },

  // Account & KYC
  {
    id: "FAQ-014",
    category: "Account & KYC",
    question: "How do I update my address?",
    answer: "Update your address in the OneCard app under Profile → Address. OTP verification is required. Changes reflect in 2-3 working days. Your new card (if issued) will be sent to the updated address.",
    tags: ["address change", "update address", "KYC", "profile"],
  },
  {
    id: "FAQ-015",
    category: "Account & KYC",
    question: "How do I update my PAN or Aadhaar?",
    answer: "KYC document updates require a fresh submission through the app under Profile → KYC Update. You'll need to upload a clear photo of the document. Processing takes 2-4 working days.",
    tags: ["PAN", "Aadhaar", "KYC", "document update"],
  },

  // Offers & Eligibility
  {
    id: "FAQ-016",
    category: "Offers & Eligibility",
    question: "How do I get lounge access?",
    answer: "OneCard provides complimentary airport lounge access based on your spend tier. Check eligibility in the app under Benefits → Lounge Access. Present your OneCard at the lounge reception — no separate membership needed.",
    tags: ["lounge", "airport lounge", "lounge access", "benefit"],
  },
  {
    id: "FAQ-017",
    category: "Offers & Eligibility",
    question: "Is there a credit limit increase option?",
    answer: "Credit limit increases are reviewed every 6 months based on your repayment history and credit score. You can also request a review in the app under Card → Credit Limit. Approval is at FPL's discretion.",
    tags: ["credit limit", "limit increase", "enhance limit"],
  },

  // General
  {
    id: "FAQ-018",
    category: "General",
    question: "What is the customer care number?",
    answer: "OneCard customer care: **1800-XXX-XXXX** (toll-free, 24/7). For RBI complaints: **14448**. Online grievance portal: cms.rbi.org.in. Chat support is also available 24/7 in the app.",
    tags: ["customer care", "helpline", "contact", "support number"],
  },
  {
    id: "FAQ-019",
    category: "General",
    question: "How secure is my OneCard?",
    answer: "OneCard uses chip-and-PIN technology, 3D Secure for online transactions, and real-time transaction alerts. You can instantly freeze/unfreeze your card in the app. International transactions can be enabled/disabled per trip.",
    tags: ["security", "safe", "fraud protection", "chip", "3D secure"],
  },
  {
    id: "FAQ-020",
    category: "General",
    question: "What is the billing cycle?",
    answer: "Your statement is generated on the **3rd of every month**. Payment due date is **25th of the month**. This gives you ~22 days from statement date to pay. Transactions after the 3rd appear in the next statement.",
    tags: ["billing cycle", "statement date", "due date", "payment date"],
  },

  // Card Concepts
  {
    id: "FAQ-021",
    category: "Card Related",
    question: "What happens when I block my card?",
    answer: "Blocking freezes all new transactions instantly — online, in-store, and contactless. Recurring charges (subscriptions, EMIs) and pending refunds continue normally. A **temporary block** can be unblocked anytime from the app. A **permanent block** (lost/stolen) triggers automatic replacement — new card in 7-10 working days.",
    tags: ["block", "card block", "block karne", "kya hota", "what happens", "freeze", "lost", "stolen"],
  },
  {
    id: "FAQ-022",
    category: "Transactions & Refunds",
    question: "What is a dispute and how does resolution work?",
    answer: "A dispute is a formal challenge against a transaction you didn't authorize, didn't receive, or was charged incorrectly. After filing: (1) provisional credit within 10 days if eligible, (2) merchant investigation, (3) final resolution within **30 days** (RBI mandate). You can check status anytime in the app under Disputes.",
    tags: ["dispute", "dispute kya", "resolution", "how does dispute", "chargeback", "reversal process"],
  },
  {
    id: "FAQ-023",
    category: "Card Related",
    question: "How do I retrieve or reset my PIN?",
    answer: "To reset your PIN: app → Cards → **Change PIN**. OTP verification required. You'll receive a secure link — the new PIN is set directly, not sent over SMS. Forgot PIN? Same flow works even if you don't remember the current one.",
    tags: ["pin", "pin forgot", "pin reset", "pin retrieve", "pin kaise", "change pin"],
  },
  {
    id: "FAQ-024",
    category: "Card Related",
    question: "What is the difference between credit limit and available credit?",
    answer: "**Credit limit** is the maximum you can spend on your card (e.g., ₹2,00,000). **Available credit** is what's left after subtracting your current outstanding and pending transactions. Example: ₹2,00,000 limit − ₹56,500 outstanding = ₹1,43,500 available. Paying your bill restores available credit.",
    tags: ["credit limit", "available credit", "difference", "limit kya", "kitna available"],
  },
  {
    id: "FAQ-025",
    category: "Bill & Repayment",
    question: "How do I avoid interest charges?",
    answer: "Pay the **full outstanding amount** by the due date (25th of each month) — this gives you up to 48 days interest-free. Paying only the minimum due means interest (3.75%/month) accrues on the entire unpaid balance from the statement date. Setting up autopay for 'Full outstanding' is the safest way to avoid interest.",
    tags: ["avoid interest", "interest bachao", "kaise bachu", "interest free", "how to avoid", "zero interest"],
  },
];

module.exports = { FAQS };
