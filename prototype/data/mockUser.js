const MOCK_USER = {
  // Identity
  name: "Rahul Sharma",
  cardType: "PRIMARY",
  network: "VISA",
  last4: "4892",
  cardStatus: "ACTIVE", // ACTIVE | BLOCKED | SUSPENDED

  // Billing
  creditLimit: 150000,
  availableCredit: 93500,
  outstanding: 56500,
  minimumDue: 2825,
  dueDate: "Apr 25, 2026",
  statementDate: "Apr 3, 2026",
  statementAmount: 58200,
  isOverdue: false,

  // Products
  activeEMIs: [
    { merchant: "Amazon", total: 45000, monthly: 3750, remaining: 8 },
  ],
  rewardPoints: 2847,
  pointValue: 711.75,

  // Recent transactions
  lastTransactions: [
    { merchant: "Swiggy",    amount: 450,   date: "Apr 12", status: "settled" },
    { merchant: "Amazon",    amount: 2999,  date: "Apr 10", status: "settled" },
    { merchant: "Flipkart",  amount: 15999, date: "Apr 8",  status: "settled" },
    { merchant: "BigBasket", amount: 1250,  date: "Apr 7",  status: "settled" },
  ],

  // Closure pre-requisites
  closurePrerequisites: {
    outstandingDue: 56500,
    pendingTransactions: true,
    activeEMI: true,
    rewardPointsToRedeem: 2847,
  },

  // Flags
  dncRegistered: false,
  pendingDispute: null,
};

// Selective context injection — only relevant fields per intent
const INTENT_CONTEXT_MAP = {
  balance_query:      ["outstanding", "minimumDue", "dueDate", "availableCredit", "creditLimit"],
  emi_query:          ["activeEMIs", "creditLimit"],
  emi_foreclosure:    ["activeEMIs"],
  rewards_query:      ["rewardPoints", "pointValue"],
  closure_flow:       ["closurePrerequisites", "outstanding"],
  dispute_flow:       ["lastTransactions", "statementDate"],
  card_block:         ["cardType", "network", "last4", "cardStatus"],
  card_replacement:   ["cardType", "network", "last4", "cardStatus"],
  fraud_report:       ["lastTransactions", "cardStatus"],
  limit_increase:     ["creditLimit", "availableCredit"],
  statement_query:    ["statementDate", "statementAmount"],
  general:            ["name", "cardStatus", "outstanding", "dueDate"],
};

module.exports = { MOCK_USER, INTENT_CONTEXT_MAP };
