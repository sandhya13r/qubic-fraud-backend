const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory storage (good enough for hackathon demo)
let transactions = [];
let walletStats = {}; // { walletId: { txCount, totalVolume, avgRisk, lastTick, lastTime } }
let nextId = 1;

// --- Helper: classify risk level from score -----------------
function riskLevelFromScore(score) {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

// --- Helper: compute risk score & reasons --------------------
function computeRisk(tx, walletInfo) {
  let score = 0;
  const reasons = [];

  const amount = tx.amount || 0;
  const tick = tx.tick || 0;
  const procedure = tx.procedure || "";
  const src = tx.source || "";
  const dest = tx.dest || "";

  // 1. Amount-based risk
  if (amount >= 1_000_000) {
    score += 45;
    reasons.push("Very large transaction amount (>= 1M QU)");
  } else if (amount >= 100_000) {
    score += 30;
    reasons.push("Large transaction amount (>= 100k QU)");
  } else if (amount >= 10_000) {
    score += 15;
    reasons.push("Moderate transaction amount (>= 10k QU)");
  }

  // 2. Procedure type risk
  const procedureRiskTable = {
    QxAddToBidOrder: 20,
    TransferShareOwnershipAndPossession: 30,
    IssueAsset: 35,
  };

  if (procedureRiskTable[procedure]) {
    score += procedureRiskTable[procedure];
    reasons.push(`High-risk procedure type: ${procedure}`);
  } else if (procedure) {
    score += 5;
    reasons.push(`Unknown / less common procedure: ${procedure}`);
  }

  // 3. Wallet activity & age
  if (walletInfo) {
    if (walletInfo.txCount <= 2 && amount >= 10_000) {
      score += 20;
      reasons.push("New wallet sending large amount");
    }

    if (walletInfo.txCount >= 5 && amount >= 50_000) {
      score += 15;
      reasons.push("Experienced wallet doing unusually large transfer");
    }

    // Burst activity: multiple txs in nearby ticks
    if (walletInfo.lastTick != null && Math.abs(tick - walletInfo.lastTick) <= 3) {
      score += 20;
      reasons.push("Rapid burst of transactions in a short tick window");
    }

    if (walletInfo.avgRisk >= 60) {
      score += 10;
      reasons.push("Wallet already has history of risky transactions");
    }
  } else {
    // No history for this wallet
    if (amount >= 10_000) {
      score += 10;
      reasons.push("Brand new wallet with significant amount");
    }
  }

  // 4. Simple address pattern heuristics
  if (src && dest && src === dest) {
    score += 10;
    reasons.push("Source and destination wallet are identical");
  }

  // Hard cap
  if (score > 100) score = 100;

  const level = riskLevelFromScore(score);
  return { score, level, reasons };
}

// ---- Update wallet stats ------------------------------------
function updateWalletStats(walletId, txRisk, tx) {
  if (!walletId) return;

  if (!walletStats[walletId]) {
    walletStats[walletId] = {
      walletId,
      txCount: 0,
      totalVolume: 0,
      avgRisk: 0,
      lastTick: null,
      lastTime: null,
    };
  }

  const w = walletStats[walletId];
  w.txCount += 1;
  w.totalVolume += tx.amount || 0;
  // simple rolling avg
  w.avgRisk = (w.avgRisk * (w.txCount - 1) + txRisk.score) / w.txCount;
  w.lastTick = tx.tick || w.lastTick;
  w.lastTime = new Date().toISOString();
}

// ====== API: Receive transaction from n8n / EasyConnect ======
app.post("/api/transactions", (req, res) => {
  // Support both { data: {...} } and plain {...}
  const raw = req.body.data || req.body;

  const tx = {
    id: nextId++,
    amount: Number(raw.amount) || 0,
    source: raw.source || "",
    dest: raw.dest || "",
    tick: Number(raw.tick) || 0,
    procedure: raw.procedure || "",
    time: new Date().toISOString(),
  };

  // Look up wallet info (source wallet perspective)
  const walletInfo = walletStats[tx.source];

  // Compute risk
  const risk = computeRisk(tx, walletInfo);

  // Store enhanced transaction
  const stored = {
    ...tx,
    riskScore: risk.score,
    riskLevel: risk.level,
    reasons: risk.reasons,
  };
  transactions.push(stored);

  // Update wallet stats for both source and dest
  updateWalletStats(tx.source, risk, tx);
  updateWalletStats(tx.dest, risk, tx);

  console.log("TX received:", stored);

  res.json({
    status: "ok",
    transaction: stored,
  });
});

// ====== API: Get all transactions (with optional filters) =====
app.get("/api/transactions", (req, res) => {
  const { level, limit } = req.query;

  let filtered = transactions;
  if (level) {
    filtered = filtered.filter(
      (t) => t.riskLevel.toUpperCase() === level.toUpperCase()
    );
  }

  const lim = limit ? parseInt(limit, 10) : filtered.length;
  res.json(filtered.slice(-lim).reverse()); // newest first
});

// ====== API: Summary for dashboard (cards & charts) ==========
app.get("/api/summary", (req, res) => {
  const totalTx = transactions.length;
  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);

  const byLevel = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  transactions.forEach((t) => {
    byLevel[t.riskLevel] = (byLevel[t.riskLevel] || 0) + 1;
  });

  // Top risky wallets
  const walletsArr = Object.values(walletStats);
  walletsArr.sort((a, b) => b.avgRisk - a.avgRisk);
  const topWallets = walletsArr.slice(0, 5);

  res.json({
    totalTransactions: totalTx,
    totalVolume,
    byLevel,
    uniqueWallets: walletsArr.length,
    topWallets,
    recent: transactions.slice(-10).reverse(),
  });
});

// ====== API: Wallet detail (profile page) =====================
app.get("/api/wallet/:id", (req, res) => {
  const id = req.params.id;
  const stats = walletStats[id];

  const txs = transactions
    .filter((t) => t.source === id || t.dest === id)
    .slice(-50)
    .reverse();

  if (!stats && txs.length === 0) {
    return res.status(404).json({ error: "Wallet not found" });
  }

  res.json({
    walletId: id,
    stats: stats || null,
    transactions: txs,
  });
});

// ====== Health check ==========================================
app.get("/", (req, res) => {
  res.send("Qubic Fraud Backend is running.");
});

// ====== Start server ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});

