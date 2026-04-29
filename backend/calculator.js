const { create, all } = require('mathjs');

const math = create(all, {});
const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:8000').replace(/\/$/, '');

class EMLNode {
  constructor(left, right = null, op = null) {
    if (right === null) {
      this.isLeaf = true;
      this.value = left;
      this.left = null;
      this.right = null;
      this.op = null;
      return;
    }

    this.isLeaf = false;
    this.value = null;
    this.op = op;
    this.left = left instanceof EMLNode ? left : new EMLNode(left);
    this.right = right instanceof EMLNode ? right : new EMLNode(right);
  }
}

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

function toEML(ast) {
  function compile(node) {
    if (node.type === 'number') {
      return new EMLNode(node.value);
    }

    const left = compile(node.left);
    const right = compile(node.right);

    switch (node.op) {
      case '+':
        return new EMLNode(left, right, 'add');
      case '-':
        return new EMLNode(left, right, 'sub');
      case '*':
        return new EMLNode(left, right, 'mul');
      case '/':
        return new EMLNode(left, right, 'div');
      default:
        throw createError('Opérateur non supporté');
    }
  }

  return compile(ast);
}

async function runWorker(emlTree) {
  let response;

  try {
    response = await fetch(`${WORKER_URL}/eml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eml: emlTree }),
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
  const emlTree = toEML(ast);
  return runWorker(emlTree);
}

module.exports = {
  parseExpression,
  toEML,
  calculateExpression,
};
