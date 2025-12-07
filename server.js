const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // replaces body-parser

// ------------------ IN-MEMORY DATABASE ------------------
let transactions = [];
let walletStats = {};
let nextId = 1;

// ------------------ RISK LEVEL UTILS ------------------
function riskLevelFromScore(score) {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

// ------------------ FRAUD ANALYSIS ENGINE ------------------
function computeRisk(tx, walletInfo) {
  let score = 0;
  const reasons = [];

  const amount = tx.amount || 0;
  const tick = tx.tick || 0;
  const procedure = tx.procedure || "";
  const src = tx.source || "";
  const dest = tx.dest || "";

  // --- Amount-based scoring ---
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

  // --- Procedure risk scoring ---
  const procedureRisk = {
    QxAddToBidOrder: 20,
    TransferShareOwnershipAndPossession: 30,
    IssueAsset: 35,
  };

  if (procedureRisk[procedure]) {
    score += procedureRisk[procedure];
    reasons.push(`High-risk procedure: ${procedure}`);
  } else if (procedure) {
    score += 5;
    reasons.push(`Unknown procedure: ${procedure}`);
  }

  // --- Wallet behavior scoring ---
  if (walletInfo) {
    if (walletInfo.txCount <= 2 && amount >= 10_000) {
      score += 20;
      reasons.push("New wallet doing large transaction");
    }

    if (walletInfo.txCount >= 5 && amount >= 50_000) {
      score += 15;
      reasons.push("Experienced wallet abnormal volume");
    }

    if (
      walletInfo.lastTick != null &&
      Math.abs(tick - walletInfo.lastTick) <= 3
    ) {
      score += 20;
      reasons.push("Burst activity detected (multiple tx in short time)");
    }

    if (walletInfo.avgRisk >= 60) {
      score += 10;
      reasons.push("Wallet already has risky history");
    }
  } else {
    if (amount >= 10_000) {
      score += 10;
      reasons.push("Brand new wallet with significant amount");
    }
  }

  // --- Wallet heuristics ---
  if (src && dest && src === dest) {
    score += 10;
    reasons.push("Source and destination wallet identical");
  }

  // Cap the score
  score = Math.min(score, 100);

  return {
    score,
    level: riskLevelFromScore(score),
    reasons,
  };
}

// ------------------ WALLET STAT UPDATES ------------------
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

  w.txCount++;
  w.totalVolume += tx.amount || 0;
  w.avgRisk = (w.avgRisk * (w.txCount - 1) + txRisk.score) / w.txCount;
  w.lastTick = tx.tick;
  w.lastTime = new Date().toISOString();
}

// ------------------ POST: RECEIVE TRANSACTIONS ------------------
app.post("/api/transactions", (req, res) => {
  try {
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

    const walletInfo = walletStats[tx.source];
    const risk = computeRisk(tx, walletInfo);

    const stored = {
      ...tx,
      riskScore: risk.score,
      riskLevel: risk.level,
      reasons: risk.reasons,
    };

    transactions.push(stored);

    updateWalletStats(tx.source, risk, tx);
    updateWalletStats(tx.dest, risk, tx);

    return res.json({ status: "ok", transaction: stored });
  } catch (err) {
    console.error("Error processing transaction:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------ GET: ALL TRANSACTIONS ------------------
app.get("/api/transactions", (req, res) => {
  res.json(transactions.slice().reverse());
});

// ------------------ GET: SUMMARY ------------------
app.get("/api/summary", (req, res) => {
  const totalTx = transactions.length;
  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);

  const byLevel = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  transactions.forEach((t) => {
    byLevel[t.riskLevel]++;
  });

  const walletsArr = Object.values(walletStats).sort(
    (a, b) => b.avgRisk - a.avgRisk
  );

  res.json({
    totalTransactions: totalTx,
    totalVolume,
    byLevel,
    uniqueWallets: walletsArr.length,
    topWallets: walletsArr.slice(0, 5),
    recent: transactions.slice(-10).reverse(),
  });
});

// ------------------ GET: WALLET PROFILE ------------------
app.get("/api/wallet/:id", (req, res) => {
  const id = req.params.id;

  const txs = transactions
    .filter((t) => t.source === id || t.dest === id)
    .slice(-50)
    .reverse();

  res.json({
    walletId: id,
    stats: walletStats[id] || null,
    transactions: txs,
  });
});

// ------------------ GET: LATEST TX ------------------
app.get("/api/transactions/latest", (req, res) => {
  res.json(transactions.at(-1) || {});
});

// ------------------ ROOT ------------------
app.get("/", (req, res) => {
  res.send("Qubic Fraud Backend is running.");
});

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on port", PORT));
