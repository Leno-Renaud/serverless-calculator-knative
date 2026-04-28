const { calculateExpression } = require('./calculator');

const expression = process.argv.slice(2).join(' ').trim();

if (!expression) {
  console.error('Usage: node cli.js "4+3×(2.2+4)"');
  process.exit(1);
}

calculateExpression(expression)
  .then(result => console.log(result))
  .catch(error => {
    console.error(error.message || 'Erreur de calcul');
    process.exit(1);
  });
