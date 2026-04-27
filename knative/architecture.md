Après avoir appliqué le YAML knative:

1) Déclarer ton domaine public via sslip.io (remplace `<IP>` par ton IP LAN)

Récupère ton IP LAN (macOS):

```bash
ipconfig getifaddr en0
```

Ajoute-la au `config-domain` de Knative :

```bash
kubectl patch configmap config-domain -n knative-serving --type merge -p '{"data":{"<NOUVELLE_IP>.sslip.io":""}}'
```

5) Exposer Kourier

Le plus simple chez moi est de faire un `port-forward` sur un port libre, par exemple `8080`.

```bash
kubectl -n kourier-system port-forward svc/kourier 31910:80 --address 0.0.0.0
```

Tu laisses cette commande ouverte dans le terminal.

Ensuite depuis n'importe quel PC du LAN ouvre :

```text
http://calc-serverless.default.<IP>.sslip.io:8080/
```
Fin.
