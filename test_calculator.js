const assert = require('assert');
const { calculateExpression } = require('./calculator');

function approx(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol;
}

function runTests() {
  console.log('Running calculator tests (via Python)...');

  // Simple cases
  let r = calculateExpression('2+3');
  assert(approx(r, 5), '2+3 should be 5');

  r = calculateExpression('2+3*4');
  assert(approx(r, 14), '2+3*4 should be 14');

  r = calculateExpression('(2+3)*4');
  assert(approx(r, 20), '(2+3)*4 should be 20');

  r = calculateExpression('4+3×(2.2+4)');
  assert(approx(r, 22.6), '4+3×(2.2+4) should be 22.6');

  // Division by zero
  let threw = false;
  try {
    calculateExpression('1/0');
  } catch (e) {
    threw = true;
    assert(e.message && e.message.toLowerCase().includes('division'), 'Expected division by zero error');
  }
  assert(threw, 'Division by zero should throw');

  console.log('All tests passed');
}

runTests();
