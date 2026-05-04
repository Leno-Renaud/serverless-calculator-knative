# Kubernetes (k3s) - Tutoriel Complet

## Architecture

L'application **Serverless Calculator** est composée de 3 services :
- **Frontend** : Nginx Alpine (interface web)
- **Backend** : Node.js + Express (orchestration des calculs)
- **Worker** : Python Flask (évaluation des expressions mathématiques)

## Étape 1 : Préparer les Dockerfiles

Vérifier que chaque service a un Dockerfile :
- `Frontend/calculator-interface/Dockerfile`
- `backend/calc/Dockerfile`
- `backend/worker/Dockerfile`

## Étape 2 : Construire les images Docker

```bash
cd /path/to/serverless-calculator

# Reconstruire les 3 images
docker build -t frontend:latest ./Frontend/calculator-interface
docker build -t backend:latest ./backend/calc
docker build -t worker:latest ./backend/worker
(podman save localhost/worker:latest -o worker.tar
podman save localhost/backend:latest -o backend.tar
podman save localhost/frontend:latest -o frontend.tar
sudo k3s ctr images import worker.tar
sudo k3s ctr images import backend.tar
sudo k3s ctr images import frontend.tar)
```

## Étape 3 : Utiliser le descripteur Kubernetes

Le fichier `docker-to-serverless/kdescriptor-linux.yaml` contient toute la configuration :
- **Namespace** : `calculator` (isolation logique)
- **Deployments** : 1 pour chaque service
- **Services** : 3 services (ClusterIP interne + NodePort frontend)

Le descripteur spécifie aussi :
- Réplicas : 1 par service (modifiable)
- Port-forwarding : Frontend sur port 30080
- Variables d'environnement : `WORKER_URL` et `FLASK_PORT`

## Étape 4 : Déployer les manifests
*(je recommande de tout faire en étant root, c'est plus simple)*
Avant toute chose, démarrez le programme shell du serveur avec `./startk3sServer.sh`. Ce programme se trouve dans l'iso k3s dispo sur tc-net, dans le dossier `home/user`.

```bash
kubectl apply -f docker-to-serverless/kdescriptor-linux.yaml
```

Vérifier que les pods se lancent :
```bash
kubectl get pods -n calculator
```
## Étape 5 : Accéder à l'application

Les services Kubernetes sont internes au cluster. Utiliser **port-forward** pour créer des tunnels réseau :

```bash
# Terminal 1 : Frontend (Nginx)
kubectl port-forward -n calculator service/frontend 8080:80 --address 127.0.0.1

# Terminal 2 : Backend (Node.js)
kubectl port-forward -n calculator service/backend 3000:3000 --address 127.0.0.1
```

## Étape 6 : Tester l'application

**Navigateur web** :
```
http://localhost:8080
```

**API avec curl** :
```bash
curl -X POST http://localhost:3000/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"2+2"}'
```

## Commandes Utiles

### Pods et Services
```bash
# Lister les pods
kubectl get pods -n calculator

# Voir les services
kubectl get svc -n calculator

# Voir les détails d'un pod
kubectl describe pod -n calculator pod/backend-*

# Voir les logs
kubectl logs -n calculator pod/backend-*
kubectl logs -n calculator pod/worker-*
kubectl logs -n calculator pod/frontend-*
```

Bonne déploiement !
