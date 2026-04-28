# Appel d'API depuis le front-end

Ci-dessous, je présente deux manières d'appeler l'API depuis le front-end.

L'API est un backend Node.js (Express) qui expose une route de calcul.

## 1) Utiliser `fetch`

### Exemple en JavaScript

```js
// Option 1 : Envoi d'une requête POST avec fetch
fetch("http://localhost:3000/api/calculator/calculate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ expression: "2+3" }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log("Résultat :", data);
  })
  .catch((err) => {
    console.error("Erreur :", err);
  });
```

### Exemple en React

```jsx
import { useState } from "react";

export default function Calculator() {
  const [expression, setExpression] = useState("2+3");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCalculate = async () => {
    setError(null);
    try {
      const response = await fetch(
        "http://localhost:3000/api/calculator/calculate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expression }),
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Calculatrice</h1>
      <input
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
      />
      <button onClick={handleCalculate}>Calculer</button>

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      {error && <p style={{ color: "red" }}>Erreur : {error}</p>}
    </div>
  );
}
```

## 2) Utiliser `axios`

### Installer axios

```bash
npm install axios
```

### Exemple en JavaScript

```js
import axios from "axios";

axios
  .post("http://localhost:3000/api/calculator/calculate", {
    expression: "2+3",
  })
  .then((response) => {
    console.log("Résultat :", response.data);
  })
  .catch((error) => {
    console.error("Erreur :", error);
  });
```

### Exemple en React

```jsx
import { useState } from "react";
import axios from "axios";

export default function CalculatorAxios() {
  const [expression, setExpression] = useState("2+3");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCalculate = async () => {
    setError(null);
    try {
      const response = await axios.post(
        "http://localhost:3000/api/calculator/calculate",
        { expression }
      );
      setResult(response.data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Calculatrice (Axios)</h1>
      <input
        value={expression}
        onChange={(e) => setExpression(e.target.value)}
      />
      <button onClick={handleCalculate}>Calculer</button>

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      {error && <p style={{ color: "red" }}>Erreur : {error}</p>}
    </div>
  );
}
```

## Notes sur CORS

Si votre front-end tourne sur un port différent (par exemple `http://localhost:5173` ou `http://localhost:3001`) et que vous obtenez une erreur CORS, assurez-vous que le backend autorise les origines nécessaires.

Par exemple, dans Express, vous pouvez utiliser le middleware `cors` :

```js
import cors from "cors";
app.use(cors());
```

Ou restreindre aux origines attendues :

```js
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3001"],
  })
);
```
