const express = require('express');
const router = express.Router();
const astParser = require('../services/astParser');
const { EMLCompiler } = require('../services/emlCompiler');
const { EMLOrchestrator } = require('../services/emlOrchestrator');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:5000'; 
const orchestrator = new EMLOrchestrator(WORKER_URL);


router.post('/', async (req, res) => {
  const { expression, debug, x } = req.body || {};
  
  if (!expression) {
    return res.status(400).json({ error: 'missing expression' });
  }
  
  try {
    // 1. Parse → AST
    const ast = astParser.parse(expression);
    
    // 2. Compile AST → EML Tree
    const compiler = new EMLCompiler();
    const emlTree = compiler.compile(ast);
    
    // 3. Évaluation via worker Python
    const xValue = x !== undefined ? x : 0;
    const evalResult = await orchestrator.evaluateSafe(emlTree, xValue);

    // 4. Construction réponse
    const resultValue = evalResult.success ? evalResult.result : null;
    const isComplex = resultValue && typeof resultValue === 'object' && typeof resultValue.re === 'number' && typeof resultValue.im === 'number';
    const response = {
      expression: expression,
      result: isComplex ? resultValue.re : resultValue,
      complex: isComplex ? resultValue : undefined,
      error: evalResult.error
    };

    if (response.complex === undefined) {
      delete response.complex;
    }

    if (debug && evalResult.success) {
      response.debug = {
        ast: ast,
        emlTree: emlTree.toString(),
        emlJSON: emlTree.toJSON(),
        depth: emlTree.depth(),
        nodeCount: emlTree.nodeCount()
      };
    }

    if (evalResult.error) {
      response.error = evalResult.error;
    }
    
    res.json(response);
    
  } catch (err) {
    console.error('Compilation error:', err);
    res.status(400).json({ 
      error: err.message || String(err),
      expression: expression
    });
  }
});

module.exports = router;

