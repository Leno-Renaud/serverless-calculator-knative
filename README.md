# Backend calculator

Backend Node.js orchestrateur : reçoit une expression arithmétique, la convertit en arbre EML, et délègue l'évaluation à un worker Python.

## Architecture

### MVP actuel (local)

```
Frontend
  → POST /calculate  { "expression": "4+3×(2.2+4)" }
  → Backend Node (orchestrateur)
      normalizeExpression()
      parseExpression()    → AST
      toEML()              → arbre EML
      runEmlWorker()       → subprocess python3 calculator.py
  → Worker Python local
      eval_eml()           → résultat via cmath
  → Backend → { "result": 22.6 }
  → Frontend
```

> Le worker Python est actuellement exécuté localement dans le même conteneur pour
> valider le pipeline EML. Dans la version distribuée, ce worker sera exécuté dans
> des pods Kubernetes/Knative, et le backend ne fera que l'orchestration via HTTP.

### Architecture cible (Kubernetes / Knative)

```
Frontend
  → Backend Node (orchestrateur)
      runEmlWorker()  →  POST WORKER_URL/eml  { "eml": <arbre> }
                     ←  { "result": 22.6 }
  → Workers Python dans des pods Kubernetes / Knative
  → Backend → Frontend
```

La fonction `runEmlWorker()` dans [calculator.js](calculator.js) est le seul point
à modifier pour passer du mode local au mode distribué.

---

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
# → 22.6
```

## Docker

```bash
docker build -t calculator-backend .
docker run -p 3000:3000 calculator-backend
```

## API

`POST /calculate`

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

## Opérateurs supportés

- `+`, `-`
- `*` et `×` pour la multiplication
- `/` et `÷` pour la division
- parenthèses
- nombres entiers et décimaux
