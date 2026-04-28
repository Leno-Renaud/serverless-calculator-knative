# Knative Complete Control

Ce document rassemble les principaux leviers de controle Knative Serving pour une application de type `Service` et pour la configuration globale du cluster.

## 1. Ou regler quoi

- Par application, dans le YAML du `Service` Knative: `spec.template.metadata.annotations` et `spec.template.spec`.
- Globalement pour toutes les revisions, dans la ConfigMap `config-autoscaler` de `knative-serving`.
- Pour la concurrence hard limit de base, dans `config-defaults` ou directement dans `containerConcurrency`.
- Pour la classe d'autoscaler, le choix KPA vs HPA se fait avec `autoscaling.knative.dev/class` ou la cle globale `pod-autoscaler-class`.

## 2. Controles par revision dans le YAML du Service

Exemple de base:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: calc-serverless
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/class: kpa.autoscaling.knative.dev
        autoscaling.knative.dev/metric: concurrency
        autoscaling.knative.dev/target: "10"
        autoscaling.knative.dev/target-utilization-percentage: "70"
        autoscaling.knative.dev/min-scale: "1"
        autoscaling.knative.dev/max-scale: "5"
        autoscaling.knative.dev/initial-scale: "1"
        autoscaling.knative.dev/activation-scale: "1"
        autoscaling.knative.dev/scale-down-delay: "0s"
        autoscaling.knative.dev/panic-window-percentage: "10"
        autoscaling.knative.dev/panic-threshold-percentage: "200"
        autoscaling.knative.dev/target-burst-capacity: "200"
    spec:
      containerConcurrency: 10
      timeoutSeconds: 300
      containers:
        - image: docker.io/lenorenaud/calculatrice:1.0
          imagePullPolicy: Never
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
```

### 2.1 Classe d'autoscaler

- `autoscaling.knative.dev/class`: choisit le moteur.
- Valeurs principales:
  - `kpa.autoscaling.knative.dev`: autoscaling Knative par defaut, base sur la concurrence ou le RPS.
  - `hpa.autoscaling.knative.dev`: delegue a Kubernetes HPA, utile pour CPU ou memoire.

### 2.2 Metrique observee

- `autoscaling.knative.dev/metric`
- Valeurs courantes:
  - `concurrency`: nombre de requetes simultanees par pod.
  - `rps`: requests per second.
  - `cpu`: pour HPA.
  - `memory`: pour HPA.
- Par defaut, KPA utilise `concurrency`.

### 2.3 Cible d'autoscaling

- `autoscaling.knative.dev/target`
- Sens selon la metrique:
  - `concurrency`: nombre de requetes en vol par pod.
  - `rps`: debit cible en requetes par seconde.
  - `cpu`: en millicores si HPA.
  - `memory`: en Mi si HPA.
- Pour `concurrency`, on peut aussi utiliser `autoscaling.knative.dev/target-utilization-percentage` pour dire a quel pourcentage du target on commence a monter.

### 2.4 Limites de scale

- `autoscaling.knative.dev/min-scale`: nombre minimum de pods.
- `autoscaling.knative.dev/max-scale`: nombre maximum de pods.
- `autoscaling.knative.dev/initial-scale`: nombre de pods au premier demarrage.
- `autoscaling.knative.dev/activation-scale`: nombre de pods a creuser quand on repart de zero.
- `autoscaling.knative.dev/scale-down-delay`: delai avant une baisse de scale.

### 2.5 Paniques et windows KPA

- `autoscaling.knative.dev/window`: annotation per revision pour la stable window.
- `stable-window`: reglage global dans `config-autoscaler`.
- `autoscaling.knative.dev/panic-window-percentage`: taille de la fenetre panic en pourcentage de la stable window.
- `autoscaling.knative.dev/panic-threshold-percentage`: seuil qui declenche le mode panic.

### 2.6 Transport de trafic et buffering

- `autoscaling.knative.dev/target-burst-capacity`
  - `0`: Activator seulement au scale-from-zero.
  - `-1`: Activator toujours dans le chemin.
  - autre valeur: ajustement du buffering et du passage par l'Activator.

### 2.7 Contrainte dure de concurrency

- `spec.containerConcurrency`
- C'est une limite dure, pas une simple cible.
- Si la valeur est elevee, le service accepte plus de requetes par pod.
- Si la valeur est basse, Knative bufferise plus vite et scale plus agressivement.
- Si tu mets aussi une cible souple, Knative utilise la plus petite des deux.

### 2.8 Ressources par pod

- `spec.template.spec.containers[].resources.requests.cpu`
- `spec.template.spec.containers[].resources.requests.memory`
- `spec.template.spec.containers[].resources.limits.cpu`
- `spec.template.spec.containers[].resources.limits.memory`

Ces champs ne pilotent pas directement le nombre de pods, mais ils controlent la capacite de chaque pod et les contraintes du scheduler.

### 2.9 Timeout de requete

- `spec.template.spec.timeoutSeconds`
- Definit le temps maximum pour une requete Knative avant expiration.

## 3. Controles globaux dans `config-autoscaler`

La ConfigMap est dans le namespace `knative-serving`.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: config-autoscaler
  namespace: knative-serving
data:
  container-concurrency-target-default: "100"
  container-concurrency-target-percentage: "70"
  requests-per-second-target-default: "200"
  min-scale: "0"
  max-scale: "0"
  max-scale-limit: "0"
  initial-scale: "1"
  allow-zero-initial-scale: "true"
  activation-scale: "1"
  enable-scale-to-zero: "true"
  scale-to-zero-grace-period: "30s"
  scale-to-zero-pod-retention-period: "0s"
  stable-window: "60s"
  panic-window-percentage: "10"
  panic-threshold-percentage: "200"
  max-scale-up-rate: "1000"
  max-scale-down-rate: "2"
  target-burst-capacity: "200"
  activator-capacity: "100"
  scale-down-delay: "0s"
  pod-autoscaler-class: "kpa.autoscaling.knative.dev"
```

### 3.1 Ce que controle chaque cle

- `container-concurrency-target-default`: target concurrence globale par defaut.
- `container-concurrency-target-percentage`: pourcentage du target concurrency a viser avant scale-up.
- `requests-per-second-target-default`: target RPS globale par defaut.
- `min-scale`: minimum global de replicas.
- `max-scale`: maximum global de replicas.
- `max-scale-limit`: plafond global qui peut bloquer des `max-scale` trop hauts.
- `initial-scale`: nombre de replicas au demarrage initial.
- `allow-zero-initial-scale`: autorise `initial-scale: 0`.
- `activation-scale`: nombre de pods a demarrer au retour de zero.
- `enable-scale-to-zero`: active ou non le scale-to-zero.
- `scale-to-zero-grace-period`: delai avant passage a zero.
- `scale-to-zero-pod-retention-period`: combien de temps garder le dernier pod avant suppression.
- `stable-window`: fenetre stable du KPA.
- `panic-window-percentage`: taille de la fenetre panic.
- `panic-threshold-percentage`: seuil d'entree en panic.
- `max-scale-up-rate`: vitesse maximale de montée en charge.
- `max-scale-down-rate`: vitesse maximale de baisse de charge.
- `target-burst-capacity`: capacite de burst avant buffering par l'Activator.
- `activator-capacity`: capacite globale de l'Activator.
- `scale-down-delay`: delai global avant scale-down.
- `pod-autoscaler-class`: classe par defaut, KPA ou HPA.

## 4. Difference entre KPA et HPA

### KPA

- Par defaut pour Knative Serving.
- Scale base sur `concurrency` ou `rps`.
- Supporte scale-to-zero.
- Utilise `stable-window`, `panic-window-percentage`, `panic-threshold-percentage`, `max-scale-up-rate`, `max-scale-down-rate`.

### HPA

- Delegue a Kubernetes HPA.
- Utile pour `cpu` ou `memory`.
- Ne scale pas a zero dans la pratique Knative classique.
- Repose surtout sur `autoscaling.knative.dev/class: hpa.autoscaling.knative.dev` et `autoscaling.knative.dev/metric: cpu|memory`.

## 5. Regles rapides pour choisir

- Si tu veux empecher totalement le scale-to-zero, mets `min-scale: "1"`.
- Si tu veux garder une app toujours chaude, mets aussi `initial-scale: "1"`.
- Si tu veux plus de pods plus vite, baisse `autoscaling.knative.dev/target` ou `autoscaling.knative.dev/target-utilization-percentage`.
- Si tu veux moins de pods et moins de churn, monte `target` et allonge `scale-down-delay`.
- Si tu veux une limite dure sur les requetes par pod, regle `containerConcurrency`.
- Si tu veux que l'Activator intervienne moins souvent, baisse `target-burst-capacity` ou augmente la cible de concurrency.
- Si tu veux une scale-up agressive, baisse `panic-threshold-percentage` vers sa limite basse.
- Si tu veux une reaction plus douce, augmente `panic-window-percentage` ou `stable-window` au niveau global.
- Si tu veux retarder la suppression du dernier pod apres la chute du trafic, regle `scale-to-zero-pod-retention-period`.

## 6. Exemples de profils

### Profil simple et stable

```yaml
annotations:
  autoscaling.knative.dev/class: kpa.autoscaling.knative.dev
  autoscaling.knative.dev/metric: concurrency
  autoscaling.knative.dev/target: "10"
  autoscaling.knative.dev/min-scale: "1"
  autoscaling.knative.dev/max-scale: "3"
spec:
  containerConcurrency: 10
```

### Profil tres reactif

```yaml
annotations:
  autoscaling.knative.dev/class: kpa.autoscaling.knative.dev
  autoscaling.knative.dev/metric: concurrency
  autoscaling.knative.dev/target: "1"
  autoscaling.knative.dev/target-utilization-percentage: "50"
  autoscaling.knative.dev/target-burst-capacity: "0"
  autoscaling.knative.dev/min-scale: "0"
  autoscaling.knative.dev/max-scale: "10"
spec:
  containerConcurrency: 1
```

### Profil CPU avec HPA

```yaml
annotations:
  autoscaling.knative.dev/class: hpa.autoscaling.knative.dev
  autoscaling.knative.dev/metric: cpu
  autoscaling.knative.dev/target: "100"
  autoscaling.knative.dev/min-scale: "1"
  autoscaling.knative.dev/max-scale: "4"
spec:
  containerConcurrency: 0
```

## 7. Point important

Si tu veux controler le comportement d'une seule application, tu modifies surtout le YAML du `Service`.
Si tu veux changer le comportement par defaut de tout le cluster, tu modifies `config-autoscaler`.
Si tu veux changer la limite dure de concurrence par defaut, regarde aussi `config-defaults`.

## 8. Ce qui n'est pas dans `config-autoscaler`

- `containerConcurrency` est dans le `Service`, pas dans `config-autoscaler`.
- `resources.requests` et `resources.limits` sont dans le pod spec, pas dans `config-autoscaler`.
- `timeoutSeconds` est dans le `Service`, pas dans `config-autoscaler`.
- Le choix `KPA` ou `HPA` peut etre global, mais la metrique effective est souvent decidee par revision.

## 9. Resume ultra court

Pour avoir le plus de controle, combine:

- `min-scale` et `max-scale` pour les bornes.
- `target` ou `target-utilization-percentage` pour la vitesse d'escallade.
- `containerConcurrency` pour la limite dure.
- `resources` pour la capacite de chaque pod.
- `stable-window`, `panic-window-percentage` et `panic-threshold-percentage` pour le comportement du KPA.
- `target-burst-capacity` et `activator-capacity` pour le chemin de trafic.
- `config-autoscaler` pour les defaults globaux.
