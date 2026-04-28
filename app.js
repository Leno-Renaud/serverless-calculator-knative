const express = require('express');
const { calculateExpression } = require('./calculator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend orchestrateur EML' });
});

app.post('/calculate', async (req, res) => {
  const { expression } = req.body || {};

  if (typeof expression !== 'string' || expression.trim() === '') {
    return res.status(400).json({ error: 'Expression manquante ou invalide' });
  }

  try {
    const result = await calculateExpression(expression);
    return res.json({ result });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || 'Erreur de calcul',
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

module.exports = app;
