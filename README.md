# Qubic Fraud Detection Backend

A lightweight, high-performance backend powering the **Qubic Command Center Dashboard**.  
It processes incoming Qubic-style transactions, performs real-time fraud scoring, stores wallet analytics, and exposes REST APIs for dashboards, automation engines, and EasyConnect → n8n workflows.

---

## Features

### Real-Time Risk Scoring Engine
- Multi-rule fraud detection  
- Amount anomaly scoring  
- Procedure-based risk evaluation  
- Wallet behavior modeling  
- Burst/timing pattern detection  
- Risk levels: **LOW / MEDIUM / HIGH / CRITICAL**

### Wallet Intelligence Engine
- Tracks wallet transaction history  
- Computes average risk score  
- Monitors total volume moved  
- Tracks last tick/time  
- Detects behavioral patterns

### Event Analytics
- Recent transactions  
- Top wallets  
- Risk distribution  
- Volume aggregation

### REST API Endpoints for Dashboards
- Transaction feed  
- Latest transaction snapshot  
- Summary analytics  
- Wallet insights

### EasyConnect / n8n Compatible
- Accepts webhook POST events  
- Fits into automation workflows  
- Real-time event pipeline ready

---

## Architecture Overview

EasyConnect → n8n Workflow → Render Backend API → Qubic Command Center Dashboard
↓
Risk Engine + Wallet Intelligence Engine
↓
Analytics + Summary + Fraud Scoring


The backend acts as the **intelligence & scoring layer** for the dashboard.

---

## Tech Stack

- Node.js  
- Express.js  
- CORS, BodyParser  
- In-memory datastore  
- Render deployment  
- GitHub version control

---

## API Documentation

---

## 1. **POST /api/transactions**

Submit a transaction to the fraud engine.

### Request
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
```

Response:

```json
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
```

2. GET /api/transactions

Returns all transactions (latest first).

3. GET /api/transactions/latest

Returns the most recent incoming transaction.

4. GET /api/summary

Provides system-wide analytics.

```json
{
  "totalTransactions": 142,
  "totalVolume": 9120000,
  "uniqueWallets": 32,
  "byLevel": {
    "LOW": 68,
    "MEDIUM": 42,
    "HIGH": 20,
    "CRITICAL": 12
  }
}
```

## Live Backend

Base URL:  
https://qubic-fraud-backend.onrender.com

### API Endpoints
GET /api/transactions  
GET /api/transactions/latest  
GET /api/summary  
POST /api/transactions  



