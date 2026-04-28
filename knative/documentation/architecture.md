## 1. Architecture
# Il est composé de 4 pods principaux :
1. Le Webhook : Il intercepte vos fichiers YAML avant application pour vérifier leur syntaxe et injecter des configurations par défaut. Le donne au serveur
1. Le Controller : Le serveur notifie controlleur. Le controller génère une "Révision" et crée les objets Kubernetes cachés (Deployments, ReplicaSets). => équivalent kdescriptor déployé. 
2. L'Autoscaler : Reçoit métriques de trafic. Ici, il analyse la *Concurrence* (les requêtes HTTP entrantes en temps réel). À 0 requête pendant 60s, il déclenche le "Scale-to-Zero" (tue tous les pods). S'il y a un pic de trafic, il lance instantanément X pods.
3. L'Activator (salle d'attente) : Quand une application est à 0 pod, plutôt que de rejeter une nouvelle connexion entrante, c'est l'Activator qui l'attrape. Il met la requête en pause, ordonne à l'Autoscaler de réveiller un pod, puis lui transmet la requête sans que l'utilisateur n'ait reçu d'erreur "Connection Refused".

# LA COUCHE RÉSEAU (KOURIER)
Knative a besoin d'une Ingress Gateway (un routeur intelligent de niveau 7 / HTTP).
Sur Kubernetes classique, un `Service` sans pods rejette immédiatement la requête.
Avec Kourier, on gagne trois super-pouvoirs vitaux :
1. L'interception "Scale-to-Zero" : S'il voit 0 pod pour l'application demandée, il route intelligemment le trafic vers l'Activator au lieu de planter.
2. Le routage par nom de domaine : Il lit l'URL (le header Host HTTP) pour savoir quelle application est demandée (ex: calculatrice.mondomaine vs. site-web.mondomaine) en n'écoutant que sur le port 80. 
3. Le "Traffic Splitting" : Il permet de faire du déploiement progressif en envoyant (par exemple) 90% du trafic sur la V1 et 10% sur la V2, ce que Kubernetes natif est incapable de faire.

---