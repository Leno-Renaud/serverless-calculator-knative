# Routes HTTP et Proxying (k3s vs Knative)

## Schéma global

```
[ Navigateur (local) ] 
    ↓ (requête HTTP)
[ Nginx dans Frontend ] 
    ↓ (proxy /api → backend)
[ Backend Node.js ] 
    ↓ (appel HTTP)
[ Worker Python ]
```

1.  **URL Publique :** L'utilisateur accède au site.
2.  **Reverse Proxy :** Le Frontend redirige les appels `/api/*` vers le Backend.
3.  **Communication Interne :** Le Backend appelle le Worker pour le calcul.

---

## 1. Kubernetes k3s (Classique)

### Où arrive la requête?

1. Tu tapes `http://localhost:8080/api/calculate`
2. Tu as un tunnel: `kubectl port-forward svc/frontend 8080:80 -n calculator`
3. La requête **traverse ce tunnel** et arrive au **port 80 du pod frontend** (dans le cluster)
4. **Nginx à l'intérieur du conteneur** intercepte la requête
5. Nginx lit sa config nginx-k3s.conf, voit location /api/
6. Nginx demande à CoreDNS (le DNS interne de Kubernetes): "où est backend.calculator.svc.cluster.local?"
7. CoreDNS répond avec une IP interne (ex: 10.43.x.y)
8. Nginx renvoie la requête vers cette IP sur le port 3000

### Comment est-elle interceptée?

Nginx lit sa config `nginx/nginx-k3s.conf`:
```nginx
location /api/ {
  set $backend "http://backend.calculator.svc.cluster.local:3000";
  rewrite ^/api/(.*) /$1 break;
  proxy_pass $backend;  # Supprime /api et renvoie vers backend
}
```

Flux exact:
1. Requête `/api/calculate` arrive à Nginx
2. Nginx voit `location /api/`, supprime le `/api/`
3. Nginx demande à CoreDNS: "où est `backend.calculator.svc.cluster.local`?"
4. CoreDNS répond: "IP interne 10.43.x.y"
5. Nginx envoie `/calculate` vers `10.43.x.y:3000`

### Pourquoi PAS de `resolver` en k3s?

**Les IPs des services Kubernetes sont stables:**
- Une fois qu'un service `backend` est créé, son IP interne reste la même
- Cette IP peut rester valide pendant des mois
- Nginx n'a besoin de demander l'IP qu'une fois au démarrage
- Aucune raison de le re-demander constamment

**Résultat:** Sans `resolver`, Nginx utilise l'IP en cache → ça marche parfaitement.

---

## 2. Knative (Serverless)

### Où arrive la requête?

1. Tu tapes `http://frontend.default.172.27.219.195.sslip.io:8080/api/calculate`
2. Tu as un tunnel: `kubectl port-forward svc/kourier 8080:80 -n kourier-system`
3. La requête **traverse ce tunnel** et arrive à **Kourier** (le routeur Knative)
4. Kourier lit l'en-tête `Host: frontend.default.172.27.219.195.sslip.io`
5. Kourier dit: "cette requête est pour le service `frontend` du namespace `default`"
6. Kourier **réveille le pod frontend** (s'il dormait en scale-to-zero)
7. **Nginx à l'intérieur du conteneur** reçoit /api/calculate
...

### Comment est-elle interceptée?

Nginx lit sa config `nginx/nginx-knative.conf`:
```nginx
resolver 10.43.0.10 valid=10s;  # ← CRUCIAL

location /api/ {
  set $backend "http://backend.default.svc.cluster.local";
  rewrite ^/api/(.*) /$1 break;
  proxy_pass $backend;
  proxy_set_header Host backend.default.svc.cluster.local;  # ← CRUCIAL
}
```

Flux exact:
1. Requête `/api/calculate` arrive à Nginx
2. Nginx voit `location /api/`, supprime le `/api/`
3. Nginx demande à CoreDNS: "où est `backend.default.svc.cluster.local`?"
4. CoreDNS répond: "IP interne 10.43.y.z" (ou "indisponible" si le pod est réveillé)
5. Nginx envoie `/calculate` vers cette IP
6. **Nginx inclut aussi** l'en-tête `Host: backend.default.svc.cluster.local`
7. Kourier reçoit cet en-tête et sait qu'il faut router vers le service `backend`
8. Si `backend` était à scale-to-zero, Kourier → Activator → réveille le pod

### Pourquoi DOIT-ON avoir `resolver 10.43.0.10 valid=10s` en Knative?

**Les IPs des services changent lors du scale-to-zero:**

Scénario SANS `resolver` (= catastrophe):
```
t=0s    : Backend s'endort (scale-to-zero)
         Ancienne IP: 10.43.2.5 (disparaît, est invalide)

t=1s    : Utilisateur clique sur "=", envoie POST /api/calculate
         
t=2s    : Nginx regarde son cache: "IP du backend = 10.43.2.5"
         Nginx envoie la requête à 10.43.2.5
         ERREUR: Cette IP n'existe plus!
         
t=3s    : Activator réveille le backend
         Backend redémarre avec NOUVELLE IP: 10.43.3.7
         
t=4s    : Trop tard, la requête a échoué
```

Scénario AVEC `resolver 10.43.0.10 valid=10s` (= fonctionne):
```
t=0s    : Backend s'endort
         Ancienne IP: 10.43.2.5 (disparaît)

t=1s    : Utilisateur clique sur "=", envoie POST /api/calculate

t=2s    : Nginx regarde son cache: "IP du backend = 10.43.2.5"
         Nginx RE-DEMANDE à CoreDNS: "où est backend.default.svc.cluster.local?"
         CoreDNS: "Pas de pod actuellement, mais le service existe"
         (L'Activator l'intercepte et réveille le pod)

t=3s    : Backend se réveille avec NOUVELLE IP: 10.43.3.7

t=4s    : Nginx RE-demande encore (10s en cours)
         CoreDNS: "IP = 10.43.3.7"
         Nginx envoie vers 10.43.3.7
         SUCCÈS!
```

**Tl;dr:**
- **k3s**: IPs stables → pas besoin de `resolver`
- **Knative**: IPs changent lors scale-to-zero → **`resolver valid=10s` est indispensable**

### Header Host: pourquoi c'est crucial?

Knative utilise l'en-tête `Host` HTTP pour savoir quel service réveiller.

Sans `proxy_set_header Host backend.default.svc.cluster.local;`:
- Kourier reçoit une requête avec `Host: frontend.default...` (du frontend)
- Kourier pense: "ah, c'est pour le frontend"
- Kourier la renvoie au frontend
- Boucle infinie ❌

Avec `proxy_set_header Host backend.default.svc.cluster.local;`:
- Kourier reçoit une requête avec `Host: backend.default.svc.cluster.local`
- Kourier pense: "ah, c'est pour le backend"
- Kourier réveille le backend et lui envoie
- ✅ Fonctionne

---

## 3. Résumé

| | **k3s** | **Knative** |
|---|---|---|
| **URL accédée** | `localhost:8080` | `frontend.default.<IP>.sslip.io:8080` |
| **Port-forward** | `svc/frontend` | `svc/kourier` |
| **Namespace** | `calculator` | `default` |
| **Nginx relaie vers** | `backend.calculator.svc.cluster.local:3000` | `backend.default.svc.cluster.local` |
| **resolver** | Pas besoin | **Oui, CRUCIAL** |
| **Header Host** | Pas besoin | **Oui, CRUCIAL** |
| **Scale-to-Zero** | Non | Oui (Activator réveille) |
