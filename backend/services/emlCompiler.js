/**
 * EML Compiler - Convertit AST en arbre EML (sans évaluation)
 */

class EMLNode {
  constructor(left, right = null) {
    if (right === null) {
      // Leaf node: constant 1 or variable x
      this.isLeaf = true;
      this.value = left;
      this.left = null;
      this.right = null;
    } else {
      // Internal node: eml(left, right)
      this.isLeaf = false;
      this.left = left instanceof EMLNode ? left : new EMLNode(left);
      this.right = right instanceof EMLNode ? right : new EMLNode(right);
      this.value = 'eml';
    }
  }

  toString() {
    if (this.isLeaf) return String(this.value);
    return `eml(${this.left.toString()}, ${this.right.toString()})`;
  }


  toJSON() {
    if (this.isLeaf) {
      return {
        type: 'leaf',
        value: this.value
      };
    }
    return {
      type: 'eml',
      left: this.left.toJSON(),
      right: this.right.toJSON()
    };
  }
 
  depth() {
    if (this.isLeaf) return 0;
    return 1 + Math.max(this.left.depth(), this.right.depth());
  }

  nodeCount() {
    if (this.isLeaf) return 1;
    return 1 + this.left.nodeCount() + this.right.nodeCount();
  }

  // Méthode utilitaire pour afficher l'arbre en texte (debug)
  printTree(indent = 0, prefix = '') {
    const spaces = '  '.repeat(indent);
    if (this.isLeaf) {
      console.log(`${spaces}${prefix}Leaf: ${this.value}`);
    } else {
      console.log(`${spaces}${prefix}Node: eml`);
      this.left.printTree(indent + 1, 'L: ');
      this.right.printTree(indent + 1, 'R: ');
    }
  }
  // Return a simple RPN representation for debug/tests
  toRPN() {
    if (this.isLeaf) return String(this.value);
    const leftRPN = this.left.toRPN ? this.left.toRPN() : String(this.left);
    const rightRPN = this.right.toRPN ? this.right.toRPN() : String(this.right);
    return `${leftRPN} ${rightRPN} eml`;
  }
}

class EMLCompiler {
  constructor() {
    this.ONE = new EMLNode('1');
    this.X = new EMLNode('x');
    
    // Cache des sous-expressions déjà compilées
    this.cache = new Map();
  }

  // ============= OPÉRATIONS DE BASE À PARTIR DE EML =============
  
  // exp(x) = eml(x, 1)
  exp(x) {
    const key = `exp_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const result = new EMLNode(x, this.ONE);
    this.cache.set(key, result);
    return result;
  }

  // ln(x) = eml(1, eml(eml(1, x), 1))
  // Construction canonique (papier arXiv:2603.21852)
  ln(x) {
    const key = `ln_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const inner = new EMLNode(new EMLNode(this.ONE, x), this.ONE);
    const result = new EMLNode(this.ONE, inner);
    this.cache.set(key, result);
    return result;
  }

  // e = eml(1, 1)
  getE() {
    if (this._e) return this._e;
    this._e = new EMLNode(this.ONE, this.ONE);
    return this._e;
  }

  // Helper: e - x = eml(1, eml(x, 1))
  // eml(1, exp(x)) = exp(1) - ln(exp(x)) = e - x
  eMinus(x) {
    const key = `eminus_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const result = new EMLNode(this.ONE, this.exp(x));
    this.cache.set(key, result);
    return result;
  }

  // neg(x) = -x, construction canonique:
  // -x = (e - x) - e = eml(ln(e-x), exp(e))
  neg(x) {
    const key = `neg_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const eMinusX = this.eMinus(x);
    const lnEMinusX = this.ln(eMinusX);
    const expE = this.exp(this.getE());
    const result = new EMLNode(lnEMinusX, expE);
    this.cache.set(key, result);
    return result;
  }

  // sub(x, y) = x - y via eml(ln(x), exp(y))
  sub(x, y) {
    const key = `sub_${this._hash(x)}_${this._hash(y)}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const lnX = this.ln(x);
    const expY = this.exp(y);
    const result = new EMLNode(lnX, expY);
    this.cache.set(key, result);
    return result;
  }

  // add(x, y) = x + y = sub(x, neg(y))

  // Traitement des constantes pour Mode B strict — construire toute constante via seulement `1` et `eml(...)`.
  add(x, y) {
    const key = `add_${this._hash(x)}_${this._hash(y)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const result = this.sub(x, this.neg(y));
    this.cache.set(key, result);
    return result;
  }

  // reciprocal(x) = 1/x = exp(-ln(x))
  reciprocal(x) {
    const key = `recip_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const lnX = this.ln(x);
    const negLnX = this.neg(lnX);
    const result = this.exp(negLnX);
    this.cache.set(key, result);
    return result;
  }

  // mul(a, b) = a * b
  // Identité utilisée : a * b = exp(ln(a) + ln(b))
  mul(a, b) {
    const key = `mul_${this._hash(a)}_${this._hash(b)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const lnA = this.ln(a);
    const lnB = this.ln(b);
    const sum = this.add(lnA, lnB);
    const result = this.exp(sum);
    this.cache.set(key, result);
    return result;
  }

  // div(a, b) = a / b
  div(a, b) {
    const key = `div_${this._hash(a)}_${this._hash(b)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const recipB = this.reciprocal(b);
    const result = this.mul(a, recipB);
    this.cache.set(key, result);
    return result;
  }

  // pow(base, exp) = base^exp = e^(exp * ln base)
  pow(base, exp) {
    const key = `pow_${this._hash(base)}_${this._hash(exp)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const lnBase = this.ln(base);
    const product = this.mul(exp, lnBase);
    const result = this.exp(product);
    this.cache.set(key, result);
    return result;
  }

  // sqrt(x) = x^(1/2)
  sqrt(x) {
    const key = `sqrt_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const two = this.nat(2);
    const half = this.reciprocal(two);
    const result = this.pow(x, half);
    this.cache.set(key, result);
    return result;
  }

  // ============= CONSTANTES / COMPLEXES =============

  // nat(n): construit un entier naturel n >= 1 uniquement à partir de 1
  // Utilise une construction par "doubling" (addition en binaire) pour éviter O(n) additions.
  nat(n) {
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`nat(${n}) invalid; expected integer >= 1`);
    }
    const key = `nat_${n}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (n === 1) return this.ONE;

    // build powers of two: powNodes[0]=1, powNodes[i]=2^i
    const powNodes = [];
    powNodes[0] = this.ONE;
    let highestBit = 0;
    for (let v = n; v > 1; v = Math.floor(v / 2)) highestBit++;
    for (let i = 1; i <= highestBit; i++) {
      powNodes[i] = this.add(powNodes[i - 1], powNodes[i - 1]);
    }

    let result = null;
    let bitIndex = 0;
    let remaining = n;
    while (remaining > 0) {
      if (remaining % 2 === 1) {
        result = result === null ? powNodes[bitIndex] : this.add(result, powNodes[bitIndex]);
      }
      remaining = Math.floor(remaining / 2);
      bitIndex++;
    }
    this.cache.set(key, result);
    return result;
  }

  // zero() = ln(1)
  zero() {
    const key = `zero`;
    if (this.cache.has(key)) return this.cache.get(key);
    const z = this.ln(this.ONE);
    this.cache.set(key, z);
    return z;
  }

  // -1 = neg(1)
  negOne() {
    const key = `negOne`;
    if (this.cache.has(key)) return this.cache.get(key);
    const r = this.neg(this.ONE);
    this.cache.set(key, r);
    return r;
  }

  // imag_unit() = i = exp( (1/2) * ln(-1) )
  imagUnit() {
    const key = `imagUnit`;
    if (this.cache.has(key)) return this.cache.get(key);

    const two = this.nat(2);
    const half = this.reciprocal(two);
    const lnNegOne = this.ln(this.negOne());
    const halfLnNegOne = this.mul(half, lnNegOne);
    const i = this.exp(halfLnNegOne);
    this.cache.set(key, i);
    return i;
  }

  // ============= FONCTIONS TRIGONOMÉTRIQUES =============
  
  // sin(x) = (e^(ix) - e^(-ix)) / (2i)
  sin(x) {
    const key = `sin_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const one = this.ONE;
    const i = this.imagUnit();
    const two = this.add(one, one);

    const ix = this.mul(i, x);
    const expIx = this.exp(ix);
    const expNegIx = this.exp(this.neg(ix));

    const diff = this.sub(expIx, expNegIx);
    const twoI = this.mul(two, i);
    const result = this.div(diff, twoI);
    this.cache.set(key, result);
    return result;
  }

  // cos(x) = (e^(ix) + e^(-ix)) / 2
  cos(x) {
    const key = `cos_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const one = this.ONE;
    const i = this.imagUnit();
    const two = this.add(one, one);

    const ix = this.mul(i, x);
    const expIx = this.exp(ix);
    const expNegIx = this.exp(this.neg(ix));

    const sum = this.add(expIx, expNegIx);
    const result = this.div(sum, two);
    this.cache.set(key, result);
    return result;
  }

  // tan(x) = sin(x) / cos(x)
  tan(x) {
    const key = `tan_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const result = this.div(this.sin(x), this.cos(x));
    this.cache.set(key, result);
    return result;
  }

  // ============= FONCTIONS HYPERBOLIQUES =============
  
  // sinh(x) = (e^x - e^(-x)) / 2
  sinh(x) {
    const key = `sinh_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const two = this.add(this.ONE, this.ONE);
    const e_x = this.exp(x);
    const e_negX = this.exp(this.neg(x));
    
    const numerator = this.sub(e_x, e_negX);
    const result = this.div(numerator, two);
    this.cache.set(key, result);
    return result;
  }

  // cosh(x) = (e^x + e^(-x)) / 2
  cosh(x) {
    const key = `cosh_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const two = this.add(this.ONE, this.ONE);
    const e_x = this.exp(x);
    const e_negX = this.exp(this.neg(x));
    
    const numerator = this.add(e_x, e_negX);
    const result = this.div(numerator, two);
    this.cache.set(key, result);
    return result;
  }

  // tanh(x) = sinh(x) / cosh(x)
  tanh(x) {
    const key = `tanh_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const result = this.div(this.sinh(x), this.cosh(x));
    this.cache.set(key, result);
    return result;
  }

  // ============= FONCTIONS INVERSES =============
  
  // arcsin(x) = -i * ln(i*x + sqrt(1 - x^2))
  arcsin(x) {
    const key = `arcsin_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const i = this.imagUnit();
    const one = this.ONE;
    const xSq = this.mul(x, x);
    const oneMinusXSq = this.sub(one, xSq);
    const sqrtTerm = this.sqrt(oneMinusXSq);
    const ixPlus = this.add(this.mul(i, x), sqrtTerm);
    const lnTerm = this.ln(ixPlus);
    const result = this.neg(this.mul(i, lnTerm));
    this.cache.set(key, result);
    return result;
  }

  // arccos(x) = -i * ln(x + i*sqrt(1 - x^2))
  arccos(x) {
    const key = `arccos_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const i = this.imagUnit();
    const one = this.ONE;
    const xSq = this.mul(x, x);
    const oneMinusXSq = this.sub(one, xSq);
    const sqrtTerm = this.sqrt(oneMinusXSq);
    const xPlus = this.add(x, this.mul(i, sqrtTerm));
    const lnTerm = this.ln(xPlus);
    const result = this.neg(this.mul(i, lnTerm));
    this.cache.set(key, result);
    return result;
  }

  // arctan(x) = (i/2) * ln((i + x)/(i - x))
  arctan(x) {
    const key = `arctan_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    // Canonical: (-i/2) * ln((1 + ix)/(1 - ix))
    const i = this.imagUnit();
    const one = this.ONE;
    const two = this.nat(2);
    const ix = this.mul(i, x);
    const numerator = this.add(one, ix);
    const denominator = this.sub(one, ix);
    const lnTerm = this.ln(this.div(numerator, denominator));
    const negIHalf = this.neg(this.mul(i, this.reciprocal(two)));
    const result = this.mul(negIHalf, lnTerm);
    this.cache.set(key, result);
    return result;
  }

  // ============= LOGARITHME EN BASE ARBITRAIRE =============
  
  // log(base, x) = ln(x) / ln(base)
  log(base, x) {
    const key = `log_${this._hash(base)}_${this._hash(x)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    
    const lnX = this.ln(x);
    const lnBase = this.ln(base);
    const result = this.div(lnX, lnBase);
    this.cache.set(key, result);
    return result;
  }

  // ============= FONCTIONS UTILITAIRES =============
  
  _hash(obj) {
    if (obj instanceof EMLNode) {
      return obj.toString();
    }
    return String(obj);
  }

  // Convert a numeric constant into an EMLNode built only from ONE and X
  // Uses binary doubling for integers and rational approximation for decimals
  _constToEML(value) {
    // cache
    const key = `const_${String(value)}`;
    if (this.cache.has(key)) return this.cache.get(key);

    // handle exact 1
    if (value === 1) return this.ONE;

    // handle zero
    if (value === 0) {
      const zero = this.zero();
      this.cache.set(key, zero);
      return zero;
    }

    // negative
    if (value < 0) {
      const pos = this._constToEML(-value);
      const neg = this.neg(pos);
      this.cache.set(key, neg);
      return neg;
    }

    // if integer, build via nat()
    if (Number.isInteger(value)) {
      const result = this.nat(value);
      this.cache.set(key, result);
      return result;
    }

    // non-integer: approximate as rational p/q where q = 10^k with k <= 3
    const str = String(value);
    const parts = str.split('.');
    let k = 0;
    if (parts.length === 2) k = Math.min(parts[1].length, 3);
    const q = Math.pow(10, k);
    const p = Math.round(value * q);
    const numerator = this._constToEML(p);
    const denominator = this._constToEML(q);
    const result = this.div(numerator, denominator);
    this.cache.set(key, result);
    return result;
  }

  // ============= COMPILATION PRINCIPALE =============
  
  compile(ast) {
    return this._compileNode(ast);
  }

  _compileNode(node) {
    if (!node) return this.ONE;
    
    // Xử lý số: Mode B strict — construire toute constante via seulement `1` et `eml(...)`.
    if (node.type === 'number') {
      return this._constToEML(node.value);
    }
    
    // Gérer les variables
    if (node.type === 'var') {
      const name = String(node.name || '').toLowerCase();
      if (name === 'x' || name === 'x0') return this.X;
      throw new Error(`Unsupported variable: ${node.name} (only 'x' supported)`);
    }
    
    // Gérer les opérateurs
    if (node.type === 'op') {
      const left = this._compileNode(node.left);
      const right = node.right ? this._compileNode(node.right) : null;
      
      switch (node.op) {
        case '+': return this.add(left, right);
        case '-': 
          if (right === null) {
            // Unary minus: -x
            return this.neg(left);
          }
          return this.sub(left, right);
        case '*': return this.mul(left, right);
        case '/': return this.div(left, right);
        case '^': return this.pow(left, right);
        default: throw new Error(`Unsupported operator: ${node.op}`);
      }
    }
    
    // Gérer les fonctions
    if (node.type === 'func') {
      const name = node.name.toLowerCase();
      const args = (node.args || []).map(arg => this._compileNode(arg));
      
      switch (name) {
        case 'exp': return this.exp(args[0]);
        case 'ln': return this.ln(args[0]);
        case 'log': 
          // log(x) hoặc log(base, x)
          if (args.length === 1) return this.log(this.getE(), args[0]);
          return this.log(args[0], args[1]);
        case 'sqrt': return this.sqrt(args[0]);
        case 'sin': return this.sin(args[0]);
        case 'cos': return this.cos(args[0]);
        case 'tan': return this.tan(args[0]);
        case 'sinh': return this.sinh(args[0]);
        case 'cosh': return this.cosh(args[0]);
        case 'tanh': return this.tanh(args[0]);
        case 'arcsin':
        case 'asin': return this.arcsin(args[0]);
        case 'arccos':
        case 'acos': return this.arccos(args[0]);
        case 'arctan':
        case 'atan': return this.arctan(args[0]);
        default: throw new Error(`Unsupported function: ${name}`);
      }
    }
    
    throw new Error(`Cannot compile node: ${JSON.stringify(node)}`);
  }
}

module.exports = { EMLCompiler, EMLNode };