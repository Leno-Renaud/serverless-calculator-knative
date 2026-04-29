# Kubernetes (k3s) sur macOS avec Colima

## Prérequis
- Avoir 3 Dockerfiles : `Frontend/calculator-interface/Dockerfile`, `backend/calc/Dockerfile`, `backend/worker/Dockerfile`
- Avoir le manifest k8s : `docker-to-serverless/kdescriptor.yaml`

## Étape 1 : Installer et démarrer Colima avec Kubernetes

```bash
# Installation (une seule fois)
brew install colima

# Démarrer colima avec k3s
colima start --kubernetes

# Vérifier la connexion
kubectl get nodes
```

Le contexte Docker bascule automatiquement à colima. L'ancien contexte `docker-desktop` reste disponible mais inactif.

## Étape 2 : Reconstruire les 3 images Docker

```bash
cd /path/to/serverless-calculator

# Reconstruire les images dans le contexte colima
docker build -t frontend:latest ./Frontend/calculator-interface
docker build -t backend:latest ./backend/calc
docker build -t worker:latest ./backend/worker
```

**Important** : Les images doivent être reconstruites après avoir lancé colima, sinon elles sont compilées pour docker-desktop, pas pour k3s.

## Étape 3 : Déployer les Manifests Kubernetes

```bash
# Appliquer tous les descriptors (namespace + deployments + services)
kubectl apply -f docker-to-serverless/kdescriptor.yaml

# Vérifier que les pods se lancent bien
kubectl get pods -n calculator

# Attendre que tous les pods soient Running
kubectl get pods -n calculator -w
```

Tous les pods doivent être `Running` pour que l'app fonctionne.

## Étape 4 : Port-forward pour accéder depuis macOS

Colima crée une VM isolée. Les services Kubernetes ne sont pas accessibles depuis localhost sans port-forward.

**Créer 2 tunnels** (dans deux fenêtres de terminal différentes) :

```bash
# Terminal 1 : Frontend (Nginx)
kubectl port-forward -n calculator service/frontend 8080:80 --address 127.0.0.1

# Terminal 2 : Backend (Node.js)
kubectl port-forward -n calculator service/backend 3000:3000 --address 127.0.0.1
```

## Étape 5 : Tester l'application

**Navigateur** : http://localhost:8080

**API avec curl** :
```bash
curl -X POST http://localhost:3000/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"2+2"}'
```

## Commandes Utiles

```bash
# Voir les pods
kubectl get pods -n calculator

# Voir les services
kubectl get svc -n calculator

# Voir les logs d'un pod
kubectl logs -n calculator pod/backend-*
kubectl logs -n calculator pod/worker-*
kubectl logs -n calculator pod/frontend-*

# Décrire un pod (debug)
kubectl describe pod -n calculator pod/backend-*

# Supprimer le namespace et tous les pods
kubectl delete namespace calculator

# Arrêter colima (en gardant les données)
colima stop

# Redémarrer colima
colima start

# Supprimer colima complètement
colima delete
```

## Basculer entre Docker Contexts

```bash
# Voir les contextes disponibles
docker context ls

# Basculer vers docker-desktop
docker context use docker-desktop

# Basculer vers colima
docker context use colima
```

## Architecture

- **Frontend** : Nginx Alpine, port 80 interne, NodePort 30080
  - Appelle `http://localhost:3000/calculate` (via port-forward)

- **Backend** : Node.js + Express, port 3000 interne
  - Appelle `http://worker:8000` (DNS interne Kubernetes)

- **Worker** : Python Flask, port 8000 interne
  - Exposé seulement dans le cluster (ClusterIP)
  - Env : `FLASK_PORT=8000`
