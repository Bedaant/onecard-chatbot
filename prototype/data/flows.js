// 8 Core Flows + 4 Additional Flows — Progressive slot-filling
// Core: card_block, card_unblock, card_replacement, account_closure,
//       emi_foreclosure, limit_increase, fraud_report, dispute_filing
// Additional: reward_redemption, statement_download, privacy_settings, support_escalation
// (bill_payment, autopay_setup, address_change, pin_change kept as utility flows)
const FLOWS = {
  card_block: {
    name: "Card Block",
    requiresOtp: true,
    slots: ["block_reason"],
    slotPrompts: {
      block_reason: "Was your card **lost**, **stolen**, or did you notice **suspicious activity**? Or do you want to **temporarily block** it?",
    },
    slotOptions: {
      block_reason: ["Lost", "Stolen", "Suspicious activity", "Temporary block"],
    },
    completion: (slots, user) =>
      `Your ${user.network} card ending **${user.last4}** has been blocked (Reason: ${slots.block_reason}). A replacement card will be dispatched to your registered address in 7-10 working days. You'll receive an SMS confirmation shortly.`,
    deepLink: "Track Replacement",
  },

  card_unblock: {
    name: "Card Unblock",
    requiresOtp: true,
    slots: [],
    completion: (slots, user) =>
      `Your ${user.network} card ending **${user.last4}** has been unblocked. You can start using it immediately for online and in-store transactions. ✓`,
    deepLink: null,
  },

  card_replacement: {
    name: "Card Replacement",
    requiresOtp: true,
    slots: ["reason"],
    slotPrompts: {
      reason: "What is the reason for replacement?",
    },
    slotOptions: {
      reason: ["Damaged", "Stolen", "Lost", "Upgrade"],
    },
    completion: (slots, user) =>
      `Replacement ${user.network} card requested (Reason: ${slots.reason}). Delivery in **7-10 working days** to your registered address. Your card number will change — EMIs and standing instructions migrate automatically. ✓`,
    deepLink: "Track Delivery",
  },

  account_closure: {
    name: "Account Closure",
    requiresOtp: true,
    slots: ["confirm"],
    slotPrompts: {
      confirm: "To confirm account closure, please type **CLOSE MY ACCOUNT** below.",
    },
    slotOptions: {},
    preCheck: (user) => {
      const issues = [];
      const p = user.closurePrerequisites;
      if (p.outstandingDue > 0)
        issues.push(`Outstanding due: ₹${p.outstandingDue.toLocaleString("en-IN")}`);
      if (p.pendingTransactions)
        issues.push("Pending transactions: must settle before closure");
      if (p.activeEMI)
        issues.push("Active EMI: Amazon ₹3,750/month (8 months remaining) — must be foreclosed");
      if (p.rewardPointsToRedeem > 0)
        issues.push(`Unused reward points: ${p.rewardPointsToRedeem} (₹${(p.rewardPointsToRedeem * 0.25).toFixed(2)} value — will be forfeited)`);
      return issues;
    },
    completion: (slots, user) => {
      if (slots.confirm?.toLowerCase().trim() !== "close my account") {
        return "Confirmation text didn't match. Account closure has been cancelled. How else can I help you?";
      }
      return `Account closure request submitted. Timeline: **7 working days** after all prerequisites are cleared. Reference number: CLO-${Math.random().toString().slice(2, 10).toUpperCase()}. You'll receive a confirmation SMS and email. ✓`;
    },
  },

  emi_conversion: {
    name: "EMI Conversion",
    requiresOtp: false,
    slots: ["transaction", "tenure"],
    slotPrompts: {
      transaction: "Which transaction would you like to convert to EMI? Share the merchant name or amount.",
      tenure: "Which tenure would you prefer?",
    },
    slotOptions: {
      tenure: ["3 months", "6 months", "9 months", "12 months"],
    },
    completion: (slots, user) => {
      const amount = parseFloat(String(slots.transaction).replace(/[^0-9.]/g, "")) || 0;
      const months = parseInt(slots.tenure) || 6;
      const fee = Math.max(99, amount * 0.01);
      const monthly = amount > 0 ? (amount / months).toFixed(2) : "calculated at checkout";
      return `EMI conversion initiated for **${slots.transaction}** over **${slots.tenure}**.\n\nEMI amount: ₹${monthly}/month · Processing fee: ₹${fee.toFixed(2)} (1%, min ₹99) · GST extra.\n\nThis will reflect in your next statement. ✓`;
    },
    deepLink: "Open EMI Screen",
  },

  dispute_filing: {
    name: "Dispute Filing",
    requiresOtp: false,
    slots: ["transaction", "reason"],
    slotPrompts: {
      transaction: "Which transaction do you want to dispute? Share the merchant name and amount (e.g., Swiggy ₹450, Apr 12).",
      reason: "What is the reason for the dispute?",
    },
    slotOptions: {
      reason: ["Not received", "Wrong amount", "Duplicate charge", "Fraud/Unauthorized"],
    },
    completion: (slots, user) => {
      const refId = "DIS-" + Math.random().toString().slice(2, 10).toUpperCase();
      return `Dispute filed for **${slots.transaction}** (Reason: ${slots.reason}).\n\nReference: **${refId}** · Resolution within **30 days** (RBI mandate). You'll receive SMS updates. Keep this reference number for follow-up. ✓`;
    },
  },

  bill_payment: {
    name: "Bill Payment",
    requiresOtp: false,
    slots: [],
    completion: (slots, user) =>
      `Your outstanding is **₹${user.outstanding.toLocaleString("en-IN")}** (minimum due: ₹${user.minimumDue.toLocaleString("en-IN")}) due on **${user.dueDate}**.\n\nPay the full amount to avoid interest at 3.75%/month. ✓`,
    deepLink: "Pay Now",
  },

  reward_redemption: {
    name: "Reward Redemption",
    requiresOtp: false,
    slots: [],
    completion: (slots, user) =>
      `You have **${user.rewardPoints} points** worth ₹${user.pointValue.toFixed(2)}. Minimum 500 points for redemption. Points can be redeemed against your statement balance or for gift vouchers. ✓`,
    deepLink: "Redeem Points",
  },

  statement_download: {
    name: "Statement Download",
    requiresOtp: false,
    slots: [],
    completion: (slots, user) =>
      `Your latest statement dated **${user.statementDate}** is ready. Total amount: ₹${user.statementAmount.toLocaleString("en-IN")}. Downloading now. ✓`,
    deepLink: "Download Statement",
  },

  address_change: {
    name: "Address Change",
    requiresOtp: true,
    slots: ["new_address"],
    slotPrompts: {
      new_address: "Please provide your complete new address including PIN code.",
    },
    slotOptions: {},
    completion: (slots, user) =>
      `Address update request submitted. New address: **${slots.new_address}**.\n\nChanges reflect in **2-3 working days**. Your next card delivery (if any) will use the updated address. ✓`,
  },

  pin_change: {
    name: "PIN Change",
    requiresOtp: true,
    slots: [],
    completion: (slots, user) =>
      `PIN change request received. You'll receive an SMS with a secure link to set your new PIN. The link expires in 30 minutes. ✓`,
    deepLink: null,
  },

  autopay_setup: {
    name: "AutoPay Setup",
    requiresOtp: false,
    slots: ["autopay_type"],
    slotPrompts: {
      autopay_type: "What amount would you like to autopay each month?",
    },
    slotOptions: {
      autopay_type: ["Full outstanding", "Minimum due", "Fixed amount"],
    },
    completion: (slots, user) =>
      `AutoPay setup initiated for **${slots.autopay_type}** from your linked bank account. Activation takes up to **2 billing cycles**. You'll receive a confirmation SMS once active. ✓`,
  },

  // ── Core flows missing from prototype ──────────────────────────────────────

  emi_foreclosure: {
    name: "EMI Foreclosure",
    requiresOtp: false,
    slots: ["emi_select"],
    slotPrompts: {
      emi_select: "Which EMI would you like to foreclose early?",
    },
    slotOptions: {
      emi_select: ["Amazon ₹3,750/month (8 remaining)"],
    },
    completion: (slots, user) => {
      const remaining = 8;
      const monthly = 3750;
      const principal = remaining * monthly;
      const fee = Math.max(99, principal * 0.03);
      return `EMI foreclosure initiated for **${slots.emi_select}**.\n\nOutstanding principal: ₹${principal.toLocaleString("en-IN")} · Foreclosure fee: ₹${fee.toFixed(2)} (3%, min ₹99) · GST extra.\n\nTotal payable: ₹${(principal + fee).toFixed(2)}. This will reflect in your next statement. ✓`;
    },
    deepLink: "Open EMI Screen",
  },

  limit_increase: {
    name: "Credit Limit Increase",
    requiresOtp: false,
    slots: ["amount"],
    slotPrompts: {
      amount: "What credit limit would you like to request? (Current limit: ₹1,50,000)",
    },
    slotOptions: {},
    completion: (slots, user) => {
      const refId = "LIM-" + Math.random().toString().slice(2, 8).toUpperCase();
      return `Credit limit increase request submitted for **${slots.amount}**.\n\nReference: **${refId}** · Review based on repayment history and credit score · Decision within **5-7 working days**. You'll receive an SMS update. ✓`;
    },
  },

  fraud_report: {
    name: "Fraud Report",
    requiresOtp: false,
    slots: ["txn_details"],
    slotPrompts: {
      txn_details: "Please share details of the fraudulent transaction — merchant name, amount, and date (e.g., 'Amazon ₹12,000, Apr 10').",
    },
    slotOptions: {},
    completion: (slots, user) => {
      const refId = "FRD-" + Math.random().toString().slice(2, 10).toUpperCase();
      return `Fraud report filed for **${slots.txn_details}**.\n\nReference: **${refId}** · Your card has been flagged for review · Provisional credit within **10 days** if eligible · Resolution within **30 days** (RBI mandate).\n\nKeep this reference number for follow-up. ✓`;
    },
    deepLink: "Track Dispute",
  },

  // ── Additional flows ────────────────────────────────────────────────────────

  privacy_settings: {
    name: "Privacy Settings",
    requiresOtp: false,
    slots: ["preference_type"],
    slotPrompts: {
      preference_type: "What would you like to update?",
    },
    slotOptions: {
      preference_type: ["Marketing notifications", "Transaction alerts", "Data sharing preferences", "Email preferences"],
    },
    completion: (slots, user) =>
      `Your **${slots.preference_type}** preferences have been updated. Changes take effect immediately. You can update these anytime in app → Profile → Privacy. ✓`,
  },

  support_escalation: {
    name: "Support Escalation",
    requiresOtp: false,
    slots: ["issue_category"],
    slotPrompts: {
      issue_category: "What is your issue about? This helps us brief the right agent.",
    },
    slotOptions: {
      issue_category: ["Card issue", "Payment dispute", "EMI problem", "Account query", "Fraud concern", "Other"],
    },
    completion: (slots, user) => {
      const ticketId = "TKT-" + Math.random().toString().slice(2, 10).toUpperCase();
      return `Escalation raised for **${slots.issue_category}**.\n\nTicket: **${ticketId}** · A senior agent will call within **2 hours** on your registered number · Full conversation context shared — you won't need to repeat anything. ✓`;
    },
    deepLink: "Live Chat",
  },
};

// OTP flows — hardcoded, NEVER from LLM
// NOT in this list: dispute_filing, reward_redemption, statement_download,
//                   privacy_settings, support_escalation, emi_foreclosure,
//                   limit_increase, fraud_report, autopay_setup, emi_conversion
const FLOWS_REQUIRING_OTP = [
  "card_block", "card_unblock", "card_replacement",
  "account_closure", "address_change", "pin_change",
];

const requiresOtp = (flowName) => FLOWS_REQUIRING_OTP.includes(flowName);

module.exports = { FLOWS, FLOWS_REQUIRING_OTP, requiresOtp };
