# Qubic Fraud Detection Backend

A lightweight, high-performance backend built for the Qubic Command Center Dashboard. It processes incoming Qubic-style transactions, performs real-time fraud scoring, stores wallet analytics, and exposes REST APIs for dashboards, analytics engines, automation workflows, and EasyConnect → n8n pipelines.

---

## Features

### Real-Time Risk Scoring Engine
- Multi-rule fraud detection  
- Amount anomalies  
- Procedure-based risk scoring  
- Wallet behavior heuristics  
- Burst/timing detection  
- Risk level classification: LOW / MEDIUM / HIGH / CRITICAL

### Wallet Intelligence Engine
- Tracks wallet history  
- Computes average risk  
- Tracks total volume  
- Latest tick/time  
- Behavioral patterns

### Event Analytics
- Recent transactions  
- Top wallets  
- Risk distribution  
- Volume aggregation

### REST API Endpoints for Dashboards
- Transaction feed  
- Latest event snapshot  
- Summary analytics  
- Wallet insights

### EasyConnect / n8n Compatible
- Accepts webhook POST  
- Can trigger automations  
- Works with workflows, alerts, pipelines

---

## Architecture Overview

EasyConnect → n8n → Render Backend → Qubic Command Center Dashboard
                            ↓
                 Risk Engine + Wallet Engine
                            ↓
                 Analytics + Summary + Alerts


This backend acts as the intelligence layer for the dashboard.

---

## Tech Stack

- Node.js  
- Express.js  
- CORS, BodyParser  
- In-memory datastore  
- Render Deployment  
- GitHub versioning

---

## API Documentation

### 1. POST /api/transactions

Submit a transaction to the fraud engine.

Request:
```json
{
  "data": {
    "amount": 250000,
    "source": "0xA1B2",
    "dest": "0xC3D4",
    "tick": 12045,
    "procedure": "QxAddToBidOrder"
  }
}

Response:

{
  "status": "ok",
  "transaction": {
    "id": 15,
    "amount": 250000,
    "source": "0xA1B2",
    "dest": "0xC3D4",
    "tick": 12045,
    "riskScore": 65,
    "riskLevel": "HIGH",
    "reasons": ["Large amount", "High-risk procedure"],
    "time": "2025-01-01T11:45:00.230Z"
  }
}

2. GET /api/transactions

Returns all transactions (latest first).

3. GET /api/transactions/latest

Returns the latest incoming transaction.

4. GET /api/summary

Provides system-wide analytics.

Example:

{
  "totalTransactions": 142,
  "totalVolume": 9120000,
  "uniqueWallets": 32,
  "byLevel": {
    "LOW": 68,
    "MEDIUM": 42,
    "HIGH": 20,
    "CRITICAL": 12
  },
  "topWallets": [
    {
      "walletId": "0xA1B2",
      "avgRisk": 72,
      "txCount": 12
    }
  ],
  "recent": [ ... ]
}

5. GET /api/wallet/:id

Returns all transactions related to a specific wallet, as well as stats.

6. GET /

Health check confirming backend is running.

Environment Variables

None required. Render provides a dynamic PORT.

Local Development

Install dependencies:

npm install


Run server:

node server.js


Future Enhancements

Replace mock endpoints with real Qubic event stream when public API becomes available

Persistent DB (MongoDB/PostgreSQL)

Multi-node clustering

ML-based anomaly scoring

API rate limiting

JWT auth

WebSocket live stream support
