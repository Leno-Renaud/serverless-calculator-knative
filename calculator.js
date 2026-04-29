const { create, all } = require('mathjs');

const math = create(all, {});

const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:8000').replace(/\/$/, '');

class EMLNode {
  constructor(left, right = null) {
    if (right === null) {
      this.isLeaf = true;
      this.value = left;
      this.left = null;
      this.right = null;
      return;
    }

    this.isLeaf = false;
    this.value = 'eml';
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
  const one = new EMLNode(1);

  function expNode(node) {
    return new EMLNode(node, one);
  }

  function lnNode(node) {
    return new EMLNode(one, new EMLNode(new EMLNode(one, node), one));
  }

  function eNode() {
    return new EMLNode(one, one);
  }

  function eMinus(node) {
    return new EMLNode(one, expNode(node));
  }

  function negNode(node) {
    return new EMLNode(lnNode(eMinus(node)), expNode(eNode()));
  }

  function subNode(left, right) {
    return new EMLNode(lnNode(left), expNode(right));
  }

  function addNode(left, right) {
    return subNode(left, negNode(right));
  }

  function reciprocal(node) {
    return expNode(negNode(lnNode(node)));
  }

  function mulNode(left, right) {
    return expNode(addNode(lnNode(left), lnNode(right)));
  }

  function divNode(left, right) {
    return mulNode(left, reciprocal(right));
  }

  function compile(node) {
    if (node.type === 'number') {
      return new EMLNode(node.value);
    }

    const left = compile(node.left);
    const right = compile(node.right);

    switch (node.op) {
      case '+':
        return addNode(left, right);
      case '-':
        return subNode(left, right);
      case '*':
        return mulNode(left, right);
      case '/':
        return divNode(left, right);
      default:
        throw createError('Opérateur non supporté');
    }
  }

  return compile(ast);
}

// Point d'extension : aujourd'hui POST local port 8000, demain pods Kubernetes.
async function runEmlWorker(emlTree) {
  let res;
  try {
    res = await fetch(`${WORKER_URL}/eml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eml: emlTree }),
    });
  } catch (err) {
    throw createError(`Worker inaccessible: ${err.message}`, 503);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw createError('Réponse worker invalide', 502);
  }

  if (!res.ok) {
    throw createError(data.error || 'Erreur worker', 400);
  }

  if (typeof data.result !== 'number') {
    throw createError('Résultat invalide du worker', 502);
  }

  return data.result;
}

async function calculateExpression(expression) {
  const ast = parseExpression(expression);
  const emlTree = toEML(ast);
  return runEmlWorker(emlTree);
}

module.exports = {
  parseExpression,
  toEML,
  calculateExpression,
};
