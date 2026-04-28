const express = require('express');
const calculatorRouter = require('./routes/calculator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/calculate', calculatorRouter);  // API endpoint

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'EML Orchestrator' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend orchestrator running on port ${PORT}`);
  console.log(`Worker URL: ${process.env.WORKER_URL || 'http://localhost:5000'}`);
});