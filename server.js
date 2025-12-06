const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Temporary storage (later we use database)
let transactions = [];

// Receive data from n8n
app.post("/api/transactions", (req, res) => {
  const data = req.body;

  console.log("Received transaction:", data);

  // Save to memory
  transactions.push({
    ...data,
    time: new Date().toISOString(),
  });

  res.json({ message: "Transaction stored!" });
});

// Frontend/Dashboard will call this endpoint
app.get("/api/transactions", (req, res) => {
  res.json(transactions);
});

// Start server
app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});
