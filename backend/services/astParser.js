const { parse } = require('mathjs');

function build(node) {
  // Gérer les constantes numériques
  if (node.isConstantNode) {
    return { type: 'number', value: Number(node.value) };
  }
  
  // Gérer les variables (x, y, ...)
  if (node.isSymbolNode) {
    return { type: 'var', name: node.name };
  }
  
  // Gérer les opérateurs (+, -, *, /, ^)
  if (node.isOperatorNode) {
    const args = node.args || [];
    const left = args[0] ? build(args[0]) : null;
    const right = args[1] ? build(args[1]) : null;
    
    // Opérateur unaire (ex: -x)
    if (args.length === 1) {
      return { type: 'op', op: node.op, left, right: null };
    }
    
    return { type: 'op', op: node.op, left, right };
  }
  
  // Gérer les parenthèses
  if (node.isParenthesisNode) {
    return build(node.content);
  }
  
  // Gérer les fonctions (sin, cos, exp, ln, log, sqrt, etc.)
  if (node.type === 'FunctionNode' || node.isFunctionNode) {
    const fname = (node.fn && node.fn.name) || node.name || 'fn';
    const fnArgs = (node.args || []).map(build);
    return { type: 'func', name: fname, args: fnArgs };
  }
  
  throw new Error(`Unsupported node type: ${node.type}`);
}

module.exports = {
  parse(expression) {
    const node = parse(expression);
    return build(node);
  }
};