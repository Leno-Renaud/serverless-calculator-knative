## Résumé en 3 points

1. **`localhost:3000` marche parce que** : le port-forward crée un tunnel entre ta machine et le cluster. Quand le navigateur appelle `localhost:3000`, la requête est redirigée vers le Backend Pod. Exemple : `localhost:8080` peut afficher le frontend, puis le frontend appelle `localhost:3000/calculate`.

2. **`worker:8000` marche parce que** : le Backend tourne déjà dans Kubernetes, donc il peut utiliser le DNS interne du cluster. Kubernetes comprend `worker` comme le Service nommé `worker`, puis le service envoie la requête vers un pod worker.

3. **Port-forward est nécessaire sur macOS** parce que colima isole Kubernetes dans une VM. Depuis macOS, tu ne vois pas directement les IP ou le DNS internes du cluster. Le port-forward sert donc de pont réseau vers le bon service.

```bash
kubectl port-forward -n calculator service/frontend 8080:80 --address 127.0.0.1
```

"Crée un tunnel. `localhost:8080` sur ma machine, redirige vers le port 80 du Service frontend (qui a une IP stable) dans Kubernetes."

Quand tu cibler `service/frontend`, tu cibles en réalité :
- **IP stable du Service** : ex `10.43.11.125` (ClusterIP)
- **Port d'écoute** : `80` (défini dans kdescriptor.yaml)
- **Nom DNS** : `frontend` (résolvable dans le cluster)

"localhost:3000 → Service backend (port 3000)"

**En production Linux**, le DNS Kubernetes fonctionne directement depuis le cluster, donc pas besoin de port-forward pour les échanges internes.
