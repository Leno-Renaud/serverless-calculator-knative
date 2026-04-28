

## 1. Installation Pas-à-Pas

Ces commandes s'exécutent avec `kubectl` et fonctionnent de manière identique sur macOS (avec Colima) ou sur Linux Debian (avec K3s natif).

### A. Installer le cœur de Knative (Serving Core)

```bash
#mac uniquement (équivalent startk3sServer.sh)
colima start --kubernetes

# 1. Installer les ressources personnalisées
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-crds.yaml

# 2. Installer le coeur de Knative Serving
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-core.yaml
```

### B. Installer et Configurer la couche réseau (Kourier)

```bash
# 1. Installer le routeur minimaliste Kourier
kubectl apply -f https://github.com/knative-extensions/net-kourier/releases/download/knative-v1.21.0/kourier.yaml

# 2. Dire à Knative d'utiliser Kourier par défaut pour router le trafic
kubectl patch configmap/config-network \
--namespace knative-serving \
--type merge \
--patch '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'
```

### C. Activer le "Magic DNS" (sslip.io)
Évite de configurer manuellement le fichier `/etc/hosts`. Knative générera pour chaque app une URL automatiquement résolue de type `http://mon-app.default.127.0.0.1.sslip.io`.

```bash
kubectl apply -f https://github.com/knative/serving/releases/download/knative-v1.21.2/serving-default-domain.yaml
```

### E. Vérification
Attendez quelques instants, puis lancez :
```bash
kubectl get pods -n knative-serving
```
*Le cluster est prêt lorsque `activator`, `autoscaler`, `controller`, et `webhook` sont tous à l'état `Running`.*

### D. Construire le conteneur
Dans le dossier avec la dockerfile
```bash
docker login
docker build -t docker.io/TON_USER_DOCKERHUB/calculatrice:1.0 .
docker push docker.io/TON_USER_DOCKERHUB/calculatrice:1.0
```

Mettre à jour knative.yaml
Remplace le champ image par ton image Docker Hub complète:
image: docker.io/TON_USER_DOCKERHUB/calculatrice:1.0


---

## 3. Déploiement : Rendre l'application Serverless

Il suffit d'un seul fichier `knative.yaml` très simple :

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: calc-serverless
spec:
  template:
    spec:
      containers:
        # Remplacez par le nom de l'image buildée localement
        - image: docker.io/lenorenaud/calculatrice:1.0
          ports:
            - containerPort: 80
```

Puis déployez :
```bash
kubectl apply -f knative.yaml
#si jamais complete_control, apply config-autoscaler et knative.yaml
```
vérifier:
```bash
kubectl get ksvc
kubectl get revision
```

### 3. configure un domaine knative local
Récupère ton IP LAN (macOS):

```bash
ipconfig getifaddr en0
```
Ajoute-la au `config-domain` de Knative :

```bash
kubectl patch configmap config-domain -n knative-serving --type merge -p '{"data":{"<NOUVELLE_IP>.sslip.io":""}}'
```

5) Exposer Kourier (macos uniquement)

Le plus simple chez moi est de faire un `port-forward` sur un port libre, par exemple `8080`.

```bash
kubectl -n kourier-system port-forward svc/kourier 8080:80 --address 0.0.0.0
```

Tu laisses cette commande ouverte dans le terminal.

Ensuite depuis n'importe quel PC du LAN ouvre :

```text
http://calc-serverless.default.<IP>.sslip.io:8080/
```
**Bravo !** Votre application démarrera à la première requête locale. Si vous ne l'utilisez pas pendant ~60 secondes, elle s'éteindra automatiquement pour libérer la RAM de votre machine.
### 4. Commandes de vérification
```bash
#nombre de conteneurs lancés
kubectl get pods -n default
#état knative du service
kubectl get ksvc calc-serverless -o wide
kubectl get revision
#ce que fait l'autoscaler
kubectl get kpa -n default
kubectl describe kpa -n default
#Charge / consommation CPU et mémoire
kubectl top pods -n default
kubectl top pods -n knative-serving
```