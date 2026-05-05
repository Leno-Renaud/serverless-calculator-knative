const { create, all } = require('mathjs');

const math = create(all, {});
const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:8000').replace(/\/$/, '');

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeExpression(expression) {
  if (typeof expression !== 'string') {
    throw createError('Expression manquante ou invalide');
  }

  const normalized = expression
    .replace(/\s+/g, '')
    .replace(/Ã—/g, '*')
    .replace(/Ã·/g, '/')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');

  if (!normalized) {
    throw createError('Expression manquante ou invalide');
  }

  return normalized;
}

function parseExpression(expression) {
  const normalized = normalizeExpression(expression);
  let parsed;

  try {
    parsed = math.parse(normalized);
  } catch {
    throw createError('Syntaxe invalide');
  }

  const ast = toAst(parsed);
  validateAst(ast);
  return ast;
}

function toAst(node) {
  if (node.isParenthesisNode) {
    return toAst(node.content);
  }

  if (node.isConstantNode) {
    return { type: 'number', value: Number(node.value) };
  }

  if (node.isOperatorNode) {
    if (node.args.length === 1 && node.op === '-') {
      return {
        type: 'op',
        op: '-',
        left: { type: 'number', value: 0 },
        right: toAst(node.args[0]),
      };
    }

    return {
      type: 'op',
      op: node.op,
      left: toAst(node.args[0]),
      right: toAst(node.args[1]),
    };
  }

  throw createError('Caractères non supportés');
}

function validateAst(node) {
  if (!node || typeof node !== 'object') {
    throw createError('Syntaxe invalide');
  }

  if (node.type === 'number') {
    if (!Number.isFinite(node.value)) {
      throw createError('Syntaxe invalide');
    }
    return;
  }

  if (node.type === 'op') {
    if (!['+', '-', '*', '/'].includes(node.op)) {
      throw createError('Opérateur non supporté');
    }

    validateAst(node.left);
    validateAst(node.right);
    return;
  }

  throw createError('Caractères non supportés');
}

// Envoie l'AST au worker qui se charge de la conversion en EML et du calcul
async function runWorker(ast) {
  let response;

  try {
    response = await fetch(`${WORKER_URL}/worker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ast: ast }),
    });
  } catch (error) {
    throw createError(`Worker inaccessible: ${error.message}`, 503);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createError('Réponse worker invalide', 502);
  }

  if (!response.ok) {
    throw createError(payload.error || 'Erreur Python', 400);
  }

  if (typeof payload.result !== 'number') {
    throw createError('Résultat invalide du worker', 502);
  }

  return payload.result;
}

async function calculateExpression(expression) {
  const ast = parseExpression(expression);
  // Envoie directement l'AST au worker sans conversion EML
  return runWorker(ast);
}

module.exports = {
  parseExpression,
  calculateExpression,
};
