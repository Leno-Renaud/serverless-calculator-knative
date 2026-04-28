const astParser = require('./services/astParser');
const { EMLCompiler } = require('./services/emlCompiler');

const testExpressions = [
  { name: 'exp(x)', expr: 'exp(x)' },
  { name: 'ln(x)', expr: 'ln(x)' },
  { name: 'x + 1', expr: 'x + 1' },
  { name: 'x * 2', expr: 'x * 2' },
  { name: 'sin(x)', expr: 'sin(x)' },
  { name: 'sqrt(x)', expr: 'sqrt(x)' }
];

console.log('🧪 EML Compiler Tests\n' + '='.repeat(50));

for (const test of testExpressions) {
  try {
    console.log(`\n📝 Expression: ${test.expr}`);
    
    // Step 1: Parse => AST
    const ast = astParser.parse(test.expr);
    console.log(`   AST: ${JSON.stringify(ast).substring(0, 80)}...`);
    
    // Step 2: Compile => EML Tree
    const compiler = new EMLCompiler();
    const emlTree = compiler.compile(ast);
    
    // Step 3: Output
    console.log(`   EML Tree (string): ${emlTree.toString()}`);
    console.log(`   RPN: ${emlTree.toRPN()}`);
    console.log(`   Depth: ${emlTree.depth ? emlTree.depth() : 'N/A'}`);
    console.log(`   ✅ PASS`);
    
  } catch (err) {
    console.log(`   ❌ FAIL: ${err.message}`);
  }
}

console.log('\n' + '='.repeat(50));
console.log('✅ Tests completed');