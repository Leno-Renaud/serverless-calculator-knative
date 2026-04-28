# Vue des données JSON

Ce document explique la structure JSON utilisée par le backend et le type de réponses renvoyées.

## 1) Requête vers le backend

### Endpoint

`POST /api/calculator/calculate`

### Body (exemple)

```json
{
  "expression": "2+3"
}
```

Le champ `expression` contient une expression mathématique sous forme de chaîne (string).

## 2) Réponse du backend

### Exemple (réel)

```json
{
  "expression": "2+3",
  "result": 5
}
```

Selon l'implémentation, le backend peut aussi renvoyer plus d'informations (par exemple une représentation interne de l'expression), mais le champ principal attendu est `result`.

### Exemple (complexe)

Certaines expressions (par ex. `ln(-1)`) peuvent produire un résultat complexe. Dans ce cas, le backend peut renvoyer :

```json
{
  "expression": "ln(-1)",
  "result": 0,
  "complex": { "re": 0, "im": 3.141592653589793 }
}
```

## 3) Format JSON côté worker `/eml`

Le worker calcule l'opération primitive :

$$\mathrm{eml}(x,y)=\exp(x)-\ln(y)$$

### Body (réel)

```json
{ "x": 1.2, "y": 3.4 }
```

### Body (complexe)

```json
{ "x": { "re": 1.2, "im": 0.0 }, "y": { "re": 3.4, "im": 0.0 } }
```

### Réponse

```json
{ "result": { "re": 0.0, "im": 0.0 } }
```

Le backend se charge ensuite de convertir ce résultat vers un nombre réel si la partie imaginaire est négligeable.
