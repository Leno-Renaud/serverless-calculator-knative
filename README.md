# Backend calculator

Backend Node.js pour parser une expression reçue en HTTP, construire un AST, le compiler en arbre EML, et déléguer l'évaluation à Python.

Pipeline unique: **expression → AST → arbre EML → Python → résultat**

## Architecture

```
expression (string)
    ↓ parser (mathjs)
   AST
    ↓ compilateur EML (JS)
  arbre EML (JSON)
    ↓ calculator.py (python3)
  résultat (number)
```

- Python est utilisé pour évaluer l'arbre EML (via `cmath.exp` / `cmath.log`)
- EML est la représentation unique du calcul — aucune évaluation JS en parallèle
- Backend prêt pour déploiement Docker/Kubernetes

## Installation locale

```bash
npm install
npm start
```

## Tests

```bash
npm test
```

## CLI

```bash
node cli.js "2+3"
node cli.js "4+3×(2.2+4)"
```

Résultat attendu pour le second : `22.6`

## Docker

```bash
docker build -t calculator-backend .
docker run -p 3000:3000 calculator-backend
```

## API

`POST /calculate`

Body JSON :

```json
{ "expression": "4+3×(2.2+4)" }
```

Réponse :

```json
{ "result": 22.6 }
```

Exemple curl :

```bash
curl -s -X POST http://localhost:3000/calculate \
  -H "Content-Type: application/json" \
  -d '{"expression":"4+3×(2.2+4)"}'
```

Exemple PowerShell :

```powershell
$body = @{ expression = '4+3×(2.2+4)' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/calculate' -Method POST -ContentType 'application/json; charset=utf-8' -Body $body
```

Exemples d'erreur :

```json
{ "error": "Division par zéro" }
```

## Opérateurs supportés

- `+`, `-`
- `*` et `×` pour la multiplication
- `/` et `÷` pour la division
- parenthèses
- nombres entiers et décimaux
