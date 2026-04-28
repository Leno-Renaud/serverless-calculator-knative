# Instructions d'exécution

Ce dépôt contient un orchestrateur Node.js (backend) et un worker Python (EML). Voici comment lancer et tester localement les deux composants.

## Pré-requis
- Node.js (>= 16)
- Python 3.9+
- pip

## 1) Lancer le worker Python (service EML)

- Installer les dépendances :

```bash
python -m pip install -r worker-python/requirements.txt
```

- Lancer le worker (par défaut écoute sur le port 5000) :

```bash
cd worker-python
python -m uvicorn eml_worker:app --host 127.0.0.1 --port 5000
```

### Contrat API `/eml`
`POST /eml`

- Entrée JSON :
	- soit des réels : `{ "x": 1.0, "y": 2.0 }`
	- soit des complexes : `{ "x": {"re": 1.0, "im": 0.0}, "y": {"re": 2.0, "im": 0.0} }`
- Sortie JSON : `{ "result": {"re": <float>, "im": <float>} }`

Le worker calcule : `eml(x, y) = exp(x) - ln(y)` en arithmétique complexe.

Notes :
- `ln(0)` est invalide (erreur 400).
- `ln` des réels négatifs est supporté (résultat complexe).

### Exemples `/eml`

PowerShell (réels en entrée) :

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/eml' -Method POST -ContentType 'application/json' -Body '{"x":1,"y":1}'
```

PowerShell (complexes en entrée) :

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/eml' -Method POST -ContentType 'application/json' -Body '{"x":{"re":0,"im":1.5707963267948966},"y":{"re":1,"im":0}}'
```

## 2) Lancer le backend Node.js (orchestrateur)

- Installer les dépendances et démarrer :

```bash
cd backend
npm install
npm run start
```

- Le backend écoute par défaut sur le port `3000` et appelle le worker via la variable d'environnement `WORKER_URL` (par défaut `http://localhost:5000`).

### Contrat API `/calculate`
`POST /calculate` avec body JSON :

- `{ "expression": "2+3" }`
- `{ "expression": "sin(x)", "x": 0.5 }`

Réponse :
- `result` contient la partie réelle si le résultat est (quasi) réel.
- si le résultat est complexe, un champ `complex: {re, im}` est ajouté.

### Exemples `/calculate`

```bash
curl -s -X POST http://localhost:3000/calculate -H "Content-Type: application/json" -d '{"expression":"2 + 3"}'
```
```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/calculate' -Method POST -ContentType 'application/json' -Body '{"expression":"2+3"}'

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/calculate' -Method POST -ContentType 'application/json' -Body '{"expression":"sin(2)"}'

Invoke-RestMethod -Uri 'http://127.0.0.1:3000/calculate' -Method POST -ContentType 'application/json' -Body '{"expression":"sin(x)","x":0.5}'
```
# Exemple complexe (ln(-1) = i*pi)
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/calculate' -Method POST -ContentType 'application/json' -Body '{"expression":"ln(-1)"}'
```

Si votre worker tourne sur une autre URL/port :

PowerShell :

```powershell
$env:WORKER_URL = 'http://127.0.0.1:5001'
cd backend
npm run start
```

## 3) Tests rapides

- Tests de compilation EML (noeuds & RPN) :

```bash
node backend/test_calculator.js
```

## 4) Remarques d'implémentation
- Le backend : `backend/routes/calculator.js` parse l'expression, compile en arbre EML (`backend/services/emlCompiler.js`) puis évalue l'arbre en appelant `backend/services/emlOrchestrator.js`.
- Le worker Python : `worker-python/eml_worker.py` expose `POST /eml` et calcule `exp(x) - ln(y)` en complexe.

## 5) Erreurs communes
- `400 ln(0) undefined`: envoyé quand `y == 0`.
- `400 math overflow`: envoyé si des valeurs intermédiaires dépassent les limites numériques (par ex. arbre trop profond, constantes trop grandes).
- `500` côté backend: souvent causé par une réponse inattendue du worker — vérifier les logs du worker et `WORKER_URL`.

## 6) Dépannage
- Vérifier que le worker répond (PowerShell) :

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/eml' -Method POST -ContentType 'application/json' -Body '{"x":1,"y":1}'
```

- Vérifier `WORKER_URL` si le backend ne parvient pas à joindre le worker.

-- Fin
