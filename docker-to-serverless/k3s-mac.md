Lancer colima avec kubernetes
```bash
colima start --kubernetes
```
Vérifie que je suis connecté au cluster colima
```bash
kubectl get nodes
```
Le contexte docker est maitenant lié à colima et plus docker-desktop, il faut reconstruire l'image.
Envoie fichiers config au cluster
```bash
kubectl apply -f deploiement.yaml
```
vérifie que les pods se lancent bien:
```bash
kubectl get pods
```
Contrairement à Linux où le routage est natif, macOS encapsule Kubernetes dans une machine virtuelle strictement isolée, rendant l'utilisation de port-forward indispensable pour créer un tunnel réseau vers l'application.
```bash
kubectl port-forward service/calc-service 8080:80
```
on peut accéder via http://localhost:8080
Finalement, pour arrêter et remettre le contexte sur docker-destop proprement, (gardant en mémoire on peut juste start, faire le port forward)
```bash
colima stop/start
```
et pour  supprimer proprement
```bash
colima delete
```
