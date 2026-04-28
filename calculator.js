const { create, all } = require('mathjs');
const { spawnSync } = require('child_process');

const math = create(all, {});

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

function runPython(eml) {
  const emlJson = JSON.stringify(eml);
  const pythonCandidates = ['python3', 'python'];
  let lastError = null;

  for (const pyCmd of pythonCandidates) {
    let res;
    try {
      res = spawnSync(pyCmd, ['calculator.py', emlJson], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10000,
        cwd: __dirname,
      });
    } catch (err) {
      lastError = err;
      continue;
    }

    if (res.error) {
      lastError = res.error;
      continue;
    }

    const out = (res.stdout || '').trim();
    const err = (res.stderr || '').trim();

    if (res.status !== 0) {
      let msg = 'Erreur Python';
      try {
        const parsed = JSON.parse(out || err);
        msg = parsed.error || parsed.message || msg;
      } catch {}
      throw createError(msg);
    }

    if (!out) {
      throw createError('Réponse Python vide');
    }

    let parsed;
    try {
      parsed = JSON.parse(out);
    } catch (e) {
      throw createError('JSON invalide reçu de Python');
    }

    if (parsed.error) {
      throw createError(parsed.error);
    }

    if (typeof parsed.result !== 'number') {
      throw createError('Résultat invalide de Python');
    }

    return parsed.result;
  }

  const errMsg = lastError ? lastError.message : 'Python non trouvé';
  throw createError(`Impossible d'exécuter Python: ${errMsg}`);
}

function calculateExpression(expression) {
  const ast = parseExpression(expression);
  const emlTree = toEML(ast);
  return runPython(emlTree);
}

module.exports = {
  parseExpression,
  toEML,
  calculateExpression,
};